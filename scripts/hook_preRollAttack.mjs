import { FILTER } from "./filters.mjs";

Hooks.on("dnd5e.preRollAttack", (item, rollConfig) => {
    // get bonus:
    const bonuses = FILTER.mainCheck(item, "attack");
    if ( !bonuses.length ) return;
    
    // add to parts.
    const parts = rollConfig.parts.concat(bonuses.map(i => i.values.bonus));
    rollConfig.parts = parts;
});
