import { FILTER } from "./scripts/filters.mjs";
import { TRAIT_MAKER } from "./scripts/trait-maker.mjs";

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
        new TRAIT_MAKER(sheet.object).render(true);
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
    const abl = CONFIG.DND5E.abilities[save.ability] ?? "";
    const savingThrow = game.i18n.localize("DND5E.ActionSave");
    const label = game.i18n.format("DND5E.SaveDC", {dc: save.dc + totalBonus || "", ability: abl});

    for(let btn of saveButtons) btn.innerText = `${savingThrow} ${label}`;
    chatData.content = temp.innerHTML;
});

Hooks.on("dnd5e.preRollAttack", (item, rollConfig) => {
    // get bonus:
    const bonuses = FILTER.mainCheck(item, "attack");
    if ( !bonuses.length ) return;

    console.log(bonuses);
    
    // add to parts.
    const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
    rollConfig.parts = parts;
});

Hooks.on("dnd5e.preRollDamage", (item, rollConfig) => {
    // get bonus:
    const values = FILTER.mainCheck(item, "damage");
    console.log(values);
    
    // add to rollConfig.
    for( let {bonus, criticalBonusDice, criticalBonusDamage} of values ){
        if ( bonus?.length ){
            const parts = rollConfig.parts.concat(bonus);
            rollConfig.parts = parts;
        }
        if ( criticalBonusDice?.length ){
            const totalCBD = [criticalBonusDice].reduce((acc, e) => {
                try {
                    const formula = Roll.replaceFormulaData(e, rollConfig.data);
                    const total = Roll.safeEval(formula);
                    return acc + total;
                }
                catch {
                    return acc;
                }
            }, (rollConfig.criticalBonusDice ?? 0));
            rollConfig.criticalBonusDice = totalCBD;
        }
        if ( criticalBonusDamage?.length ){
            const totalCBD = [criticalBonusDamage].reduce((acc, e) => {
                return `${acc} + ${e}`;
            }, (rollConfig.criticalBonusDamage ?? "0"));
            rollConfig.criticalBonusDamage = totalCBD;
        }
    }
});

// if there are modifiers to apply, I could just loop over each die in 'parts'.
