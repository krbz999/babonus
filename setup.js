import { FILTER } from "./scripts/filters.mjs";
import { Build_a_Bonus } from "./scripts/build_a_bonus.mjs";
import { itemsWithoutBonuses } from "./scripts/constants.mjs";

Hooks.on("setup", () => {
    CONFIG.DND5E.characterFlags["babonus"] = {
        name: game.i18n.localize("BABONUS.TRAITS.NAME"),
        hint: game.i18n.localize("BABONUS.TRAITS.HINT"),
        section: game.i18n.localize("BABONUS.TRAITS.SECTION"),
        type: Boolean
    }

    game.settings.register("babonus", "headerLabel", {
		name: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.NAME"),
		hint: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
});

Hooks.on("renderActorSheetFlags", (app, html, flagData) => {
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
});

Hooks.on("dnd5e.preDisplayCard", (item, chatData, options) => {
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
});

// header button on items.
Hooks.on("getItemSheetHeaderButtons", (app, array) => {
    if ( itemsWithoutBonuses.includes(app.object.type) ) return;
    if ( !app.isEditable ) return;
    const label = game.settings.get("babonus", "headerLabel");

    const headerButton = {
        class: "babonus",
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
});

// header button on effects.
Hooks.on("getActiveEffectConfigHeaderButtons", (app, array) => {
    if ( !app.isEditable ) return;
    const label = game.settings.get("babonus", "headerLabel");

    const headerButton = {
        class: "babonus",
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
});
