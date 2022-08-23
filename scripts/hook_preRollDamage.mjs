import { FILTER } from "./filters.mjs";

Hooks.on("dnd5e.preRollDamage", (item, rollConfig) => {
    // get bonus:
    const values = FILTER.mainCheck(item, "damage");
    
    // add to rollConfig.
    for( let {bonus, criticalBonusDice, criticalBonusDamage} of values ){
        if ( bonus?.length ){
            const parts = rollConfig.parts.concat(bonus);
            rollConfig.parts = parts;
        }
        if ( criticalBonusDice?.length ){
            const totalCBD = criticalBonusDice.reduce((acc, e) => {
                return acc + Number(e);
            }, (rollConfig.criticalBonusDice ?? 0));
            rollConfig.criticalBonusDice = totalCBD;
        }
        if ( criticalBonusDamage?.length ){
            const totalCBD = criticalBonusDamage.reduce((acc, e) => {
                return `${acc} + ${e}`;
            }, (rollConfig.criticalBonusDamage ?? "0"));
            rollConfig.criticalBonusDamage = totalCBD;
        }
    }
});

// if there are modifiers to apply, I could just loop over each die in 'parts'.
