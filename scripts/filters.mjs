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

    static itemType(item, filter){
        const itemType = item.type;
        if ( !filter?.length ) return false; // this one is false, because this field is required.
        return filter.includes(itemType);
    }

    static baseWeapon(item, filter){
        const baseWeapon = item.system.baseItem;
        if ( !filter?.length ) return true;
        return filter.includes(baseWeapon);
    }

    static damageType(item, filter){
        if ( !filter?.length ) return true;
        const damageTypes = item.system.damage.parts.reduce((acc, [_, type]) => {
            if ( filter.includes(type) ) acc.push(type);
            return acc;
        }, []);
        return damageTypes.length > 0;
    }

    static spellSchool(item, filter){
        const spellSchool = item.system.school;
        if ( !filter?.length ) return true;
        return filter.includes(spellSchool);
    }

    static ability(item, filter){
        // if the item has no actionType, it has no ability.
        if ( !item.system.actionType ) return false;

        const ability = item.system.ability;
        if ( !filter?.length ) return true;

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

    static spellComponents(item, {types, match}){
        const components = item.system.components;
        if ( match === MATCH.ALL ){
            for(let key of types){
                if ( !components[key] ) return false;
                continue;
            }
            return true;
        }
        else if ( match === MATCH.ANY ){
            for( let key of types ){
                if ( components[key] ) return true;
                continue;
            }
            return false;
        }
    }

    static spellLevel(item, filter){
        // this is always the clone, so the level is what it was cast at.
        const level = item.system.level;
        if ( !filter.length ) return true;
        return filter.map(i => Number(i)).includes(level);
    }

    static actionType(item, filter){
        const actionType = item.system.actionType;
        if ( !filter?.length ) return true;
        return filter.includes(actionType);
    }
    
    static weaponProperty(item, {needed, unfit}){
        const properties = Object.entries(item.system.properties);
        
        if ( unfit?.length ){
            const matchUnfits = properties.some(([key, bool]) => {
                return bool && unfit.includes(key);
            });
            if ( matchUnfits ) return false;
        }

        if ( needed?.length ){
            const matchNeeded = properties.some(([key, bool]) => {
                return bool && needed.includes(key);
            });
            if ( !matchNeeded ) return false;
        }

        return true;
    }

}
