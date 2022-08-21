// a quick class that constructs an object of data needed for all the filters.
// should contain:
// - spellLevel (the level at which a spell was cast; for attack and damage rolls)
// - damageType (the damage type of the item; for use/attack/damage; for example, why not a +2 to DC if the spell is a fire spell?

export class CONSTRUCTOR {
    static buildData(hookType, item){
        // if hookType === 'use' or 'attack', find the spell level it was cast at, and gather up all damage types from all formulas.
        return {spellLevel, damageTypes} // damageTypes is always an array.

        // if hookType === 'damage', get the spell level, and gather up all rolled damage types. It MIGHT not be all from the item?

    }
}
