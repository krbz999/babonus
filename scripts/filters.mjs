import { MATCH } from "./constants.mjs";


/*
flags.babonus.bonuses.damage: {
    "special-fire-spell-bonus": {
        enabled: true,
        label: "Special Fire Spell Bonus",
        description: "This is a special fire spell bonus.",
        value: "1d4 + @abilities.int.mod",
        type: "bonus", // or 'modifier'
        filters: {
            itemTypes: ["spell", "weapon", "feat", "equipment", "consumable"],
            baseItems: ["dagger", "lance", "shortsword"],
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
        baseItem: this.baseItem,
        damageType: this.damageType,
        spellSchool: this.spellSchool,
        ability: this.ability,
        components: this.components,
        spellLevel: this.spellLevel,
        actionType: this.actionType,
        weaponProperty: this.weaponProperty,
        //quantity: this.quantity
    }


    static mainCheck(item, data){
        // hook type is either 'use' (to increase save dc), 'attack', 'damage'
        // are saving throws vs specific circumstances possible?
        const flag = item.actor.getFlag("babonus", `bonuses.${data.hookType}`);
        if ( !flag ) return [];
        const bonuses = Object.entries(flag);
        if( !bonuses.length ) return [];
        
        const valids = bonuses.reduce((acc, [id, {enabled, values, filters}]) => {
            if ( !enabled ) return acc;
            
            for( let key in filters ){
                let validity = filterFn[key](item, filters[key], data);
                if( !validity ) return acc;
            }
            acc.push(values);
            return acc;
        });
        return valids;

    }

    static itemType(item, filter, data){
        const itemType = item.type;
        if ( !filter?.length ) return true;
        return filter.includes(itemType);
    }

    static baseItem(item, filter, data){
        const baseItem = item.system.baseItem;
        if ( !filter?.length ) return true;
        return filter.includes(baseItem);
    }

    static damageType(item, filter, data){
        if ( !filter?.length ) return true;
        const damageTypes = data.damageTypes.filter(type => {
            return filter.includes(type);
        });
        return damageTypes.length > 0;
    }

    static spellSchool(item, filter, data){
        const spellSchool = item.system.school;
        if ( !filter?.length ) return true;
        return filter.includes(spellSchool);
    }

    static ability(item, filter, data){
        const ability = item.system.ability;
        if ( !filter?.length ) return true;
        return filter.includes(ability);
    }

    static components(item, {types, match}, data){
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

    static spellLevel(item, filter, data){
        const spellLevel = data.spellLevel;
        if ( !filter.length ) return true;
        return filter.map(i => Number(i)).includes(spellLevel);
    }

    static actionType(item, filter, data){
        const actionType = item.system.actionType;
        if ( !filter?.length ) return true;
        return filter.includes(actionType);
    }
    
    static weaponProperty(item, {needed, unfit}, data){
        const properties = Object.entries(item.system.properties);
        
        if ( unfit?.length ){
            const matchUnfits = properties.filter(([key, bool]) => {
                if ( bool && unfit.includes(key) ) return false;
                return true;
            });
            if ( matchUnfits.length ) return false;
        }

        if ( needed?.length ){
            const matchNeeded = properties.filter(([key, bool]) => {
                if ( !bool && needed.includes(key) ) return false;
                return true;
            });
            if ( !matchNeeded.length ) return false;
        }

        return true;
    }


}
