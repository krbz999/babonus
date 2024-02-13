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
    const rollData = sheet.document.getRollData();
    const bonuses = await babonus.getCollection(sheet.actor).reduce(async (acc, bonus) => {
      acc = await acc;
      const section = acc[bonus.type] ?? {};
      section.label ??= "BABONUS.Type" + bonus.type.capitalize();
      section.key ??= bonus.type;
      section.bonuses ??= [];
      section.bonuses.push({
        bonus: bonus,
        labels: bonus.sheet._prepareLabels().slice(1).filterJoin(" &bull; "),
        tooltip: await TextEditor.enrichHTML(bonus.description, {rollData})
      });
      acc[bonus.type] ??= section;
      return acc;
    }, {});
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
      const id = n.closest("[data-item-id]")?.dataset.itemId;
      const bonus = babonus.getId(sheet.document, id);
      switch (n.dataset.action) {
        case "toggle": n.addEventListener("click", (event) => bonus.toggle()); break;
        case "edit": n.addEventListener("click", (event) => bonus.sheet.render(true)); break;
        case "delete": n.addEventListener("click", (event) => bonus.delete()); break;
        case "otter-dance": n.addEventListener("click", BabonusWorkshop.prototype._onOtterDance); break;
      }
    });
    div.firstElementChild.addEventListener("drop", BabonusWorkshop.prototype._onDrop.bind(sheet));
    div.querySelectorAll("[data-item-id]").forEach(n => {
      n.addEventListener("dragstart", BabonusWorkshop.prototype._onDragStart.bind(sheet));
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
        return Array.from(babonus.getCollection(this.document));
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
