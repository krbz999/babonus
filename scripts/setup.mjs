import { BabonusWorkshop } from "./applications/babonus.mjs";
import { itemsWithoutBonuses, MODULE, SETTING_HEADERLABEL } from "./constants.mjs";

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
    default: false
  });
}

export function _renderActorSheetFlags(app, html) {
  const input = html[0].querySelector("input[name='flags.dnd5e.babonus']");
  const button = document.createElement("A");
  button.name = "flags.dnd5e.babonus";
  const label = game.i18n.localize("BABONUS.TRAITS.LABEL");
  button.innerHTML = `<i class="fa-solid fa-book-atlas"></i> ${label}`;
  input.replaceWith(button);
  button.addEventListener("click", async () => {
    new BabonusWorkshop(app.object, {
      title: `Build-a-Bonus: ${app.object.name}`
    }).render(true);
  });
}

export function _getItemSheetHeaderButtons(app, array) {
  if (itemsWithoutBonuses.includes(app.object.type)) return;
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);

  const headerButton = {
    class: MODULE,
    icon: "fa-solid fa-book-atlas",
    onclick: async () => {
      new BabonusWorkshop(app.object, {
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
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);

  const headerButton = {
    class: MODULE,
    icon: "fa-solid fa-book-atlas",
    onclick: async () => {
      new BabonusWorkshop(app.object, {
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
