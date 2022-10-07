import { Build_a_Bonus } from "./build_a_bonus.mjs";
import { itemsWithoutBonuses, MODULE, SETTING_AURABLOCKERS, SETTING_HEADERLABEL } from "./constants.mjs";

export function _setup() {
  CONFIG.DND5E.characterFlags[MODULE] = {
    name: game.i18n.localize("BABONUS.TRAITS.NAME"),
    hint: game.i18n.localize("BABONUS.TRAITS.HINT"),
    section: game.i18n.localize("BABONUS.TRAITS.SECTION"),
    type: Boolean
  }

  game.settings.register(MODULE, SETTING_HEADERLABEL, {
    name: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.NAME"),
    hint: game.i18n.localize("BABONUS.SETTINGS.DISPLAY_LABEL.HINT"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE, SETTING_AURABLOCKERS, {
    name: game.i18n.localize("BABONUS.SETTINGS.PREVENT_AURA.NAME"),
    hint: game.i18n.localize("BABONUS.SETTINGS.PREVENT_AURA.HINT"),
    scope: "world",
    config: true,
    type: String,
    default: "dead;unconscious"
  });
}

export function _renderActorSheetFlags(app, html) {
  if (!app.isEditable) return;
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

export function _getItemSheetHeaderButtons(app, array) {
  if (itemsWithoutBonuses.includes(app.object.type)) return;
  if (!app.isEditable) return;
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
  if (label) {
    const header = "BABONUS.SETTINGS.DISPLAY_LABEL.HEADER";
    headerButton.label = game.i18n.localize(header);
  }
  array.unshift(headerButton);
}

export function _getActiveEffectConfigHeaderButtons(app, array) {
  if (!app.isEditable) return;
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
  if (label) {
    const header = "BABONUS.SETTINGS.DISPLAY_LABEL.HEADER";
    headerButton.label = game.i18n.localize(header);
  }
  array.unshift(headerButton);
}
