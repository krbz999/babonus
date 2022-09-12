import { Build_a_Bonus } from "./build_a_bonus.mjs";
import { itemsWithoutBonuses, MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

export function _setup(){
    CONFIG.DND5E.characterFlags[MODULE] = {
        name: game.i18n.localize("BABONUS.TRAITS.NAME"),
        hint: game.i18n.localize("BABONUS.TRAITS.HINT"),
        section: game.i18n.localize("BABONUS.TRAITS.SECTION"),
        type: Boolean
    }

    game.settings.register(MODULE, "headerLabel", {
        name: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.NAME"),
        hint: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.HINT"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });
}

export function _renderActorSheetFlags(app, html){
    if ( !app.isEditable ) return;
    const input = html[0].querySelector("input[name='flags.dnd5e.babonus']");
    const button = document.createElement("A");
    button.name = "flags.dnd5e.babonus";
    const label = game.i18n.localize("BABONUS.TRAITS.LABEL");
    button.innerHTML = `<i class="fas fa-atlas"></i> ${label}`;
    input.replaceWith(button);
    button.addEventListener("click", async () => {
        new Build_a_Bonus(app.object, {
            title: `Build-a-Bonus: ${app.object.name}`
        }).render(true);
    });
}

export function _preDisplayCard(item, chatData){
    // get bonus:
    const data = item.getRollData();
    const bonuses = FILTER.mainCheck(item, "save");
    if ( !bonuses.length ) return;
    const totalBonus = bonuses.reduce((acc, { bonus }) => {
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
    const saveButtons = temp.querySelectorAll("button[data-action='save']");
    
    // create label (innertext)
    const save = item.system.save;
    const ability = CONFIG.DND5E.abilities[save.ability] ?? "";
    const savingThrow = game.i18n.localize("DND5E.ActionSave");
    const dc = save.dc + totalBonus || "";
    const label = game.i18n.format("DND5E.SaveDC", { dc, ability });
    
    for ( const btn of saveButtons ) btn.innerText = `${savingThrow} ${label}`;
    chatData.content = temp.innerHTML;
}

export function _preRollAttack(item, rollConfig){
    // get bonus:
    const bonuses = FILTER.mainCheck(item, "attack");
    if ( !bonuses.length ) return;

    // add to parts.
    const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
    rollConfig.parts = parts;
}

export function _preRollDamage(item, rollConfig){
    // get bonus:
    const values = FILTER.mainCheck(item, "damage");
    
    // add to rollConfig.
    for( const {bonus, criticalBonusDice, criticalBonusDamage} of values ) {
        if ( bonus?.length ) {
            const parts = rollConfig.parts.concat(bonus);
            rollConfig.parts = parts;
        }
        if ( criticalBonusDice?.length ) {
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
        if ( criticalBonusDamage?.length ) {
            const oldValue = rollConfig.criticalBonusDamage;
            let totalCBD;
            if ( oldValue ) totalCBD = `${oldValue} + ${criticalBonusDamage}`;
            else totalCBD = criticalBonusDamage;
            rollConfig.criticalBonusDamage = totalCBD;
        }
    }
}

export function _getItemSheetHeaderButtons(app, array){
    if ( itemsWithoutBonuses.includes(app.object.type) ) return;
    if ( !app.isEditable ) return;
    const label = game.settings.get(MODULE, "headerLabel");

    const headerButton = {
        class: MODULE,
        icon: "fas fa-atlas",
        onclick: async () => {
            new Build_a_Bonus(app.object, {
                title: `Build-a-Bonus: ${app.object.name}`
            }).render(true);
        }
    }
    if ( label ) {
        const header = "BABONUS.SETTINGS.DISPLAY_LABEL.HEADER";
        headerButton.label = game.i18n.localize(header);
    }
    array.unshift(headerButton);
}

export function _getActiveEffectConfigHeaderButtons(app, array){
    if ( !app.isEditable ) return;
    const label = game.settings.get(MODULE, "headerLabel");

    const headerButton = {
        class: MODULE,
        icon: "fas fa-atlas",
        onclick: async () => {
            new Build_a_Bonus(app.object, {
                title: `Build-a-Bonus: ${app.object.label}`
            }).render(true);
        }
    }
    if ( label ) {
        const header = "BABONUS.SETTINGS.DISPLAY_LABEL.HEADER";
        headerButton.label = game.i18n.localize(header);
    }
    array.unshift(headerButton);
}
