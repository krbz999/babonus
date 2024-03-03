import {MODULE, SETTINGS} from "../constants.mjs";
import {BabonusWorkshop} from "./babonus-workshop.mjs";

export class CharacterSheetTab {
  /**
   * Handle rendering a new tab on the v2 character sheet.
   * @param {ActorSheet5eCharacter2} sheet      The rendered sheet.
   * @param {HTMLElement} html                  The element of the sheet.
   */
  static async _onRenderCharacterSheet2(sheet, [html]) {
    const template = "modules/babonus/templates/subapplications/character-sheet-tab.hbs";

    const bonuses = {};

    async function _prepareBonus(bonus, rollData) {
      const section = bonuses[bonus.type] ??= {};
      section.label ??= `BABONUS.Type${bonus.type.capitalize()}`;
      section.key ??= bonus.type;
      section.bonuses ??= [];
      section.bonuses.push({
        bonus: bonus,
        labels: bonus.sheet._prepareLabels().slice(1).filterJoin(" &bull; "),
        tooltip: await TextEditor.enrichHTML(bonus.description, {rollData}),
        isEmbedded: bonus.parent.isEmbedded,
        parentName: bonus.parent.name
      });
    }

    const data = sheet.actor.getRollData();
    for(const bonus of babonus.getCollection(sheet.actor)) await _prepareBonus(bonus, data);
    for(const item of sheet.actor.items) {
      const data = item.getRollData();
      for(const bonus of babonus.getCollection(item)) await _prepareBonus(bonus, data);
      for(const effect of item.effects) for(const bonus of babonus.getCollection(effect)) {
        await _prepareBonus(bonus, data);
      }
    }
    for(const effect of sheet.actor.effects) {
      for(const bonus of babonus.getCollection(effect)) await _prepareBonus(bonus, data);
    }

    bonuses.all = {label: "BABONUS.Bonuses", key: "all", bonuses: []};

    const div = document.createElement("DIV");
    const isActive = sheet._tabs[0].active === MODULE.ID ? "active" : "";
    const isEdit = sheet.constructor.MODES.EDIT === sheet._mode;

    sheet._filters[MODULE.ID] ??= {name: "", properties: new Set()};
    div.innerHTML = await renderTemplate(template, {
      ICON: MODULE.ICON,
      parentName: sheet.document.name,
      isActive: isActive,
      isEdit: isEdit,
      sections: Object.values(bonuses).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
    });

    div.querySelectorAll("[data-action]").forEach(n => {
      n.addEventListener("click", async (event) => {
        const action = event.currentTarget.dataset.action;
        const uuid = event.currentTarget.closest("[data-item-uuid]")?.dataset.itemUuid;
        if (!uuid) return;
        const bonus = await babonus.fromUuid(uuid);
        switch (action) {
          case "toggle": return bonus.toggle();
          case "edit": return bonus.sheet.render(true);
          case "delete": return bonus.delete();
          default: return;
        }
      });
    });
    div.firstElementChild.addEventListener("drop", BabonusWorkshop.prototype._onDrop.bind(sheet));
    div.querySelectorAll("[data-item-id][draggable]").forEach(n => {
      n.addEventListener("dragstart", BabonusWorkshop.prototype._onDragStart.bind(sheet));
    });
    div.querySelector("[data-action='otter-dance']").addEventListener("click", BabonusWorkshop.prototype._onOtterDance);
    div.querySelectorAll("[data-action='bonus-source']").forEach(n => {
      n.addEventListener("click", async (event) => {
        const uuid = event.currentTarget.dataset.uuid;
        const item = await fromUuid(uuid);
        return item.sheet.render(true);
      });
    });

    html.querySelector(".tab-body").appendChild(div.firstElementChild);
    html.querySelector("button.create-child").addEventListener("click", CharacterSheetTab._createChildBonus.bind(sheet));
  }

  /**
   * Utility method that creates a popup dialog for a new bonus.
   * @returns {Promise}
   */
  static async _createChildBonus() {
    if (!this.isEditable || (this._tabs[0]?.active !== MODULE.ID)) return;
    const template = "systems/dnd5e/templates/apps/document-create.hbs";
    const data = {
      folders: [],
      folder: null,
      hasFolders: false,
      name: game.i18n.localize("BABONUS.NewBabonus"),
      type: babonus.abstract.TYPES[0],
      types: babonus.abstract.TYPES.reduce((acc, type) => {
        const label = game.i18n.localize(`BABONUS.Type${type.capitalize()}`);
        acc.push({
          type: type,
          label: label,
          icon: babonus.abstract.DataModels[type].defaultImg
        });
        return acc;
      }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
    };
    const title = game.i18n.localize("BABONUS.Create");
    return Dialog.prompt({
      content: await renderTemplate(template, data),
      label: title,
      title: title,
      render: (html) => {
        const app = html.closest(".app");
        app.querySelectorAll(".window-header .header-button").forEach(btn => {
          const label = btn.innerText;
          const icon = btn.querySelector("i");
          btn.innerHTML = icon.outerHTML;
          btn.dataset.tooltip = label;
          btn.setAttribute("aria-label", label);
        });
        app.querySelector(".document-name").select();
      },
      callback: async (html) => {
        const data = new FormDataExtended(html.querySelector("FORM")).object;
        if (!data.name?.trim()) data.name = game.i18n.localize("BABONUS.NewBabonus");
        const bonus = babonus.createBabonus(data, this.document);
        return babonus.embedBabonus(this.document, bonus);
      },
      rejectClose: false,
      options: {jQuery: false, width: 350, classes: ["dnd5e2", "create-document", "dialog", "babonus"]}
    });
  }

  /**
   * Add a new tab to the v2 character sheet.
   */
  static _addCharacterTab() {
    const cls = dnd5e.applications.actor.ActorSheet5eCharacter2;
    cls.TABS.push({
      tab: MODULE.ID, label: MODULE.NAME, icon: MODULE.ICON
    });
    /*cls.FILTER_COLLECTIONS.babonus = function(c, f) {
      console.warn({c,f})
      return Array.from(babonus.getCollection(this.document));
    };
    return;*/
    const fn = cls.prototype._filterChildren;
    class sheet extends cls {
      /** @override */
      _filterChildren(collection, filters) {
        if (collection !== "babonus") return fn.call(this, collection, filters);

        const embedded = babonus.findEmbeddedDocumentsWithBonuses(this.document);

        const actor = babonus.getCollection(this.document).contents;
        const items = embedded.items.flatMap(item => babonus.getCollection(item).contents);
        const effects = embedded.effects.flatMap(effect => babonus.getCollection(effect).contents);
        return actor.concat(items).concat(effects);
      }
    };
    cls.prototype._filterChildren = sheet.prototype._filterChildren;
  }

  /** Initialize this part of the module. */
  static setup() {
    if (!game.settings.get(MODULE.ID, SETTINGS.SHEET_TAB)) return;
    if (!game.user.isGM && !game.settings.get(MODULE.ID, SETTINGS.PLAYERS)) return;
    CharacterSheetTab._addCharacterTab();
    Hooks.on("renderActorSheet5eCharacter2", CharacterSheetTab._onRenderCharacterSheet2);
  }
}
