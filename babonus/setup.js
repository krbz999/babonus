import { FILTER } from "./scripts/filters.mjs";
import { Build_a_Bonus } from "./scripts/build_a_bonus.mjs";

Hooks.on("setup", () => {
    CONFIG.DND5E.characterFlags["babonus"] = {
        name: game.i18n.localize("BABONUS.TRAITS.NAME"),
        hint: game.i18n.localize("BABONUS.TRAITS.HINT"),
        section: game.i18n.localize("BABONUS.TRAITS.SECTION"),
        type: Boolean
    }
});

Hooks.on("renderActorSheetFlags", (sheet, html, flagData) => {
    const input = html[0].querySelector("input[name='flags.dnd5e.babonus']");
    const button = document.createElement("A");
    button.name = "flags.dnd5e.babonus";
    const label = game.i18n.localize("BABONUS.TRAITS.LABEL");
    button.innerHTML = `<i class="fas fa-atlas"></i> ${label}`;
    input.replaceWith(button);
    button.addEventListener("click", async () => {
        new Build_a_Bonus(sheet.object).render(true);
    });
});

Hooks.on("dnd5e.preDisplayCard", (item, chatData, options) => {
    // get bonus:
    const data = item.getRollData();
    const bonuses = FILTER.mainCheck(item, "save");
    if ( !bonuses.length ) return;
    const totalBonus = bonuses.reduce((acc, {bonus}) => {
        try {
            const formula = Roll.replaceFormulaData(bonus, data);
            const total = Roll.safeEval(formula);
            return acc + total;
        }
        catch {
            return acc;
        }
    }, 0);
    
    // get all buttons.
    const html = chatData.content;
    const temp = document.createElement("DIV");
    temp.innerHTML = html;
    const saveButtons = temp.querySelectorAll("button[data-action=save]");
    
    // create label (innertext)
    const save = item.system.save;
    const ability = CONFIG.DND5E.abilities[save.ability] ?? "";
    const savingThrow = game.i18n.localize("DND5E.ActionSave");
    const dc = save.dc + totalBonus || "";
    const label = game.i18n.format("DND5E.SaveDC", {dc, ability});
    
    for(let btn of saveButtons) btn.innerText = `${savingThrow} ${label}`;
    chatData.content = temp.innerHTML;
});

Hooks.on("dnd5e.preRollAttack", (item, rollConfig) => {
    // get bonus:
    const bonuses = FILTER.mainCheck(item, "attack");
    if ( !bonuses.length ) return;

    // add to parts.
    const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
    rollConfig.parts = parts;
});

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
            let totalCBD;
            try {
                const formula = Roll.replaceFormulaData(criticalBonusDice, rollConfig.data);
                totalCBD = Roll.safeEval(formula);
            } catch {
                totalCBD = 0;
            }
            const oldValue = rollConfig.criticalBonusDice ?? 0;
            rollConfig.criticalBonusDice = oldValue + totalCBD;
        }
        if ( criticalBonusDamage?.length ){
            const oldValue = rollConfig.criticalBonusDamage;
            const totalCBD = oldValue ? `${oldValue} + ${criticalBonusDamage}` : criticalBonusDamage;
            rollConfig.criticalBonusDamage = totalCBD;
        }
    }
});
