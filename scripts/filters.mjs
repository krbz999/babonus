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
            criticalBonusDice: "5",             // numbers only, 'damage' only
            criticalBonusDamage: "4d6 + 2"      // any die roll, 'damage' only
        },
        filters: {
            baseweapons: ["dagger", "lance", "shortsword"],
            damageTypes: ["fire", "cold", "bludgeoning"],
            spellSchools: ["evo", "con"],
            abilities: ["int"],
            spellComponents: {types: ["concentration", "vocal"], match: "ALL"},
            actionTypes: ["mwak", "rwak", "save", "msak", "rsak"],
            weaponProperties: {needed: ["fin", "lgt"], unfit: ["two", "ver"]},
            spellLevel: ['0','1','2','3','4','5','6','7','8','9'],
        }
    }
}
*/

export class FILTER {
    static filterFn = {
        itemType: this.itemType,
        baseWeapon: this.baseWeapon,
        damageType: this.damageType,
        spellSchool: this.spellSchool,
        ability: this.ability,
        spellComponents: this.spellComponents,
        spellLevel: this.spellLevel,
        actionType: this.actionType,
        weaponProperty: this.weaponProperty
    }


    static mainCheck(item, hookType){
        // hook type is either 'save' (to increase save dc), 'attack', 'damage'
        // are saving throws vs specific circumstances possible?
        const flag = item.actor.getFlag("babonus", `bonuses.${hookType}`);
        if ( !flag ) return [];
        const bonuses = Object.entries(flag);
        if( !bonuses.length ) return [];
        
        const valids = bonuses.reduce((acc, [id, {enabled, values, filters}]) => {
            if ( !enabled ) return acc;
            
            for( let key in filters ){
                let validity = filterFn[key](item, filters[key]);
                if( !validity ) return acc;
            }
            acc.push(values);
            return acc;
        });
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
        if ( item.type !== "weapon") return false;
        const baseWeapon = item.system.baseItem;
        return filter.includes(baseWeapon);
    }

    // return whether item has one of the applicable damage types.
    static damageType(item, filter){
        if ( !filter?.length ) return true;
        const damageTypes = !!item.labels.derivedDamage?.some(({damageType}) => {
            return filter.includes(damageType);
        });
        return damageTypes;
    }

    // return whether item belongs to the spell school.
    static spellSchool(item, filter){
        if ( !filter?.length ) return true;
        if ( item.type !== "spell" ) return false;
        const spellSchool = item.system.school;
        return filter.includes(spellSchool);
    }

    // return whether item uses one of the applicable abilities.
    static ability(item, filter){
        if ( !filter?.length ) return true;

        // if the item has no actionType, it has no ability.
        if ( !item.system.actionType ) return false;
        
        // special consideration for items set to use 'Default':
        if ( item.system.ability === "" ){
            const {abilities, attributes} = item.actor.system;

            /* If a weapon is Finesse, then a bonus applying to STR or DEX should
            apply if the relevant modifier is higher than the other. */
            if ( item.system.weaponProperties?.fin ){
                if ( filter.includes("str") && abilities.str.mod >= abilities.dex.mod ){
                    return true;
                }
                if ( filter.includes("dex") && abilities.dex.mod >= abilities.str.mod ){
                    return true;
                }
            }
            /* If it is a melee weapon attack, then a bonus applying to STR should apply. */
            if ( item.system.actionType === "mwak" ){
                if ( filter.includes("str") ) return true;
            }
            /* If it is a ranged weapon attack, then a bonus applying to DEX should apply. */
            if ( item.system.actionType === "rwak" ){
                if ( filter.includes("dex") ) return true;
            }
            /* If it is a spell attack, then bonuses applying to the actor's spellcasting ability should apply. */
            if ( ["msak", "rsak"].includes(item.system.actionType) ){
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

        const components = item.system.components;
        if ( match === MATCH.ALL ){
            // return whether types is a subset of item's components.
            return types.every(type => components[type]);
        }
        else if ( match === MATCH.ANY ){
            // return whether there is a proper union of the two.
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

    // return whether item has any of the requred actionTypes.
    static actionType(item, filter){
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
        if ( !item.type !== "weapon" ) false;
        
        const properties = item.system.properties;
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

}
