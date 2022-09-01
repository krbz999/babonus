import { MATCH } from "./constants.mjs";


/*
flags.babonus.bonuses.<damage/attack/save>: {
    <identifier>: {
        enabled: true,
        label: "Special Fire Spell Bonus",
        description: "This is a special fire spell bonus.",
        itemTypes: ["spell", "weapon", "feat", "equipment", "consumable"],
        values: {
            bonus: "1d4 + @abilities.int.mod",  // all types, but 'save' only takes numbers, not dice.
            criticalBonusDice: "5",             // strings that evaluate to numbers only (including rollData), 'damage' only
            criticalBonusDamage: "4d6 + 2"      // any die roll, 'damage' only
        },
        itemRequirements: {equipped: true, attuned: false} // for bonuses stored on items only.
        filters: {
            baseweapons: ["dagger", "lance", "shortsword"],
            damageTypes: ["fire", "cold", "bludgeoning"],
            spellSchools: ["evo", "con"],
            abilities: ["int"],
            spellComponents: {
                types: ["concentration", "vocal"],
                match: "ALL" // or ANY
            },
            attackTypes: ["mwak", "rwak", "msak", "rsak"], // only when set to 'attack'
            weaponProperties: {
                needed: ["fin", "lgt"],
                unfit: ["two", "ver"]
            },
            spellLevel: ['0','1','2','3','4','5','6','7','8','9'],
            arbitraryComparison: {
                one: "@item.uses.value",
                other: "@abilities.int.mod",
                operator: "EQ" // or LE, GE, LT, GT
            }
        }
    }
}
*/

export class FILTER {
    static filterFn = {
        itemTypes: this.itemType,
        attackTypes: this.attackType,
        baseWeapons: this.baseWeapon,
        damageTypes: this.damageType,
        spellSchools: this.spellSchool,
        abilities: this.ability,
        spellComponents: this.spellComponents,
        spellLevels: this.spellLevel,
        weaponProperties: this.weaponProperty,
        saveAbilities: this.saveAbility,
        arbitraryComparison: this.arbitraryComparison
    }


    static mainCheck(item, hookType){
        // hook type is either 'save' (to increase save dc), 'attack', 'damage'
        // are saving throws vs specific circumstances possible?

        let bonuses = [];

        // add bonuses from actor.
        const flag = item.actor.getFlag("babonus", `bonuses.${hookType}`);
        if ( flag ) bonuses = Object.entries(flag);

        // add bonuses from items.
        for ( const it of item.actor.items ) {
            const itemFlag = it.getFlag("babonus", `bonuses.${hookType}`);
            if ( !itemFlag ) continue;
            
            const itemBonuses = Object.entries(itemFlag);
            const {equipped, attunement} = it.system;
            const validItemBonuses = itemBonuses.filter(([id, {enabled, itemRequirements}]) => {
                if ( !enabled ) return false;
                const {equipped: needsEq, attuned: needsAtt} = itemRequirements;
                if ( !equipped && needsEq ) return false;
                if ( attunement !== CONFIG.DND5E.attunementTypes.ATTUNED && needsAtt ) return false;
                return true;
            });
            
            bonuses = bonuses.concat(validItemBonuses);
        }
        // add bonuses from effects.
        for ( const eff of item.actor.effects ) {
            if ( eff.disabled || eff.isSuppressed ) continue;
            const effectFlag = eff.getFlag("babonus", `bonuses.${hookType}`);
            if ( !effectFlag ) continue;

            const effectBonuses = Object.entries(effectFlag);
            const validEffectBonuses = effectBonuses.filter(([id, {enabled}]) => {
                return enabled;
            });
            bonuses = bonuses.concat(validEffectBonuses);
        }

        // bail out early if none found.
        if( !bonuses.length ) return [];
        
        // the final filtering.
        const valids = bonuses.reduce((acc, [id, {enabled, values, filters, itemTypes}]) => {
            if ( !enabled ) return acc;

            filters["itemTypes"] = itemTypes;
            
            for( let key in filters ){
                let validity = FILTER.filterFn[key](item, filters[key]);
                if( !validity ) return acc;
            }
            acc.push(values);
            return acc;
        }, []);
        return valids;
    }

    // return whether item is one of the applicable item types.
    // this field is required, so bail out if none exist.
    static itemType(item, filter){
        if ( !filter?.length ) return false;
        const itemType = item.type;
        return filter.includes(itemType);
    }

    // return whether item is one of the applicable weapon types.
    static baseWeapon(item, filter){
        if ( !filter?.length ) return true;
        // only weapons can be a type of weapon...
        if ( item.type !== "weapon") return false;
        return filter.includes(item.system.baseItem);
    }

    // return whether item has one of the applicable damage types.
    static damageType(item, filter){
        if ( !filter?.length ) return true;
        
        const damageTypes = item.getDerivedDamageLabel().some(({damageType}) => {
            return filter.includes(damageType);
        });
        return damageTypes;
    }

    // return whether item belongs to the spell school.
    static spellSchool(item, filter){
        if ( !filter?.length ) return true;
        // only spells have schools...
        if ( item.type !== "spell" ) return false;
        return filter.includes(item.system.school);
    }

    // return whether item uses one of the applicable abilities.
    static ability(item, filter){
        if ( !filter?.length ) return true;

        const {actionType, ability, properties} = item.system;

        // if the item has no actionType, it has no ability.
        if ( !actionType ) return false;
        
        // special consideration for items set to use 'Default':
        if ( !ability ){
            const {abilities, attributes} = item.actor.system;

            /* If a weapon is Finesse, then a bonus applying to STR or DEX should
            apply if the relevant modifier is higher than the other. */
            if ( item.type === "weapon" && properties.fin ){
                const str = abilities.str.mod;
                const dex = abilities.dex.mod;
                if ( filter.includes("str") && str >= dex ) return true;
                if ( filter.includes("dex") && dex >= str ) return true;
            }
            /* If it is a melee weapon attack, then a bonus applying to STR should apply. */
            if ( actionType === "mwak" && filter.includes("str") ) return true;
            /* If it is a ranged weapon attack, then a bonus applying to DEX should apply. */
            if ( actionType === "rwak" && filter.includes("dex") ) return true;
            /* If it is a spell attack or saving throw, then bonuses applying to the
            actor's spellcasting ability should apply. When actionType='save', the ability
            used is always the spellcasting ability. No matter what the itemType is. */
            if ( ["msak", "rsak", "save"].includes(actionType) ){
                if ( filter.includes(attributes.spellcasting) ) return true;
            }
        }

        return filter.includes(ability);
    }

    // return whether item has either ALL of the required spell components
    // or matches at least one of the required spell components.
    static spellComponents(item, {types, match}){
        if ( !types?.length ) return true;

        // if item is not a spell, it has no components.
        if ( item.type !== "spell") return false;

        const {components} = item.system;
        if ( match === MATCH.ALL ){
            // return whether types is a subset of item's components.
            return types.every(type => components[type]);
        }
        else if ( match === MATCH.ANY ){
            // return whether there is an intersection of the two.
            return types.some(type => components[type]);
        }
        return false;
    }

    // return whether item was cast at any of the required spell levels.
    // this is always the clone, so the level is what it was cast at.
    static spellLevel(item, filter){
        if ( !filter?.length ) return true;
        if ( item.type !== "spell" ) return false;
        const level = Number(item.system.level);
        return filter.map(i => Number(i)).includes(level);
    }

    // return whether item has any of the required attack types.
    static attackType(item, filter){
        if ( !filter?.length ) return true;
        const actionType = item.system.actionType;
        if ( !actionType ) return false;
        return filter.includes(actionType);
    }
    
    // return whether item has any of the needed weaponProperties
    // while not having any of the unfit weaponProperties
    static weaponProperty(item, {needed, unfit}){
        if ( !needed?.length && !unfit?.length ) return true;

        // if it is not a weapon, it has no weaponProperties
        if ( item.type !== "weapon" ) return false;
        
        const {properties} = item.system;
        if ( unfit?.length ){
            // does item have any of the unfit properties?
            const isUnfit = unfit.some((property) => properties[property]);
            if ( isUnfit ) return false;
        }

        if ( needed?.length ){
            // does item have any of the needed properties?
            const isFit = needed.some((property) => properties[property]);
            if ( !isFit ) return false;
        }

        return true;
    }

    // return whether the DC is set using any of the required abilities.
    // special consideration for Spellcasting ("spell") but not Flat ("flat").
    static saveAbility(item, filter){
        if ( !filter?.length ) return true;

        const scaling = item.system.save?.scaling;
        const {spellcasting} = item.actor.system.attributes;
        if ( !scaling ) return false;

        if ( scaling === "spell" ){
            return filter.includes(spellcasting);
        }
        return filter.includes(scaling);
    }

    // return whether VALUE and OTHER have the correct relation.
    static arbitraryComparison(item, {one, other, operator}){
        if ( !one || !other ) return false;

        const rollData = item.getRollData();
        let left = Roll.replaceFormulaData(one, rollData);
        let right = Roll.replaceFormulaData(other, rollData);

        try {
            // try comparing numbers.
            let nLeft = Roll.safeEval(left);
            let nRight = Roll.safeEval(right);
            if ( operator === "EQ" ) return nLeft === nRight;
            if ( operator === "LT" ) return nLeft < nRight;
            if ( operator === "GT" ) return nLeft > nRight;
            if ( operator === "LE" ) return nLeft <= nRight;
            if ( operator === "GE" ) return nLeft >= nRight;
            return false;
        }
        catch {
            // try comparing strings.
            if ( operator === "EQ" ) return left == right;
            return false;
        }
    }
}
