import {MODULE, SETTINGS} from "../constants.mjs";

/**
 * Handle rendering a new tab on the v2 character sheet.
 * @param {ActorSheet5eCharacter2} sheet      The rendered sheet.
 * @param {HTMLElement} html                  The element of the sheet.
 */
async function _onRenderCharacterSheet2(sheet, [html]) {
  const template = "modules/babonus/templates/subapplications/character-sheet-tab.hbs";

  const bonuses = {};
  const uuids = new Set();

  async function _prepareBonus(bonus, rollData) {
    uuids.add(bonus.uuid);
    const section = bonuses[bonus.type] ??= {};
    section.label ??= `BABONUS.Type${bonus.type.capitalize()}.Label`;
    section.key ??= bonus.type;
    section.bonuses ??= [];
    section.bonuses.push({
      bonus: bonus,
      labels: bonus.sheet._prepareLabels().slice(1).filterJoin(" &bull; "),
      tooltip: await TextEditor.enrichHTML(bonus.description, {
        async: true, rollData: rollData, relativeTo: bonus.origin
      }),
      isEmbedded: bonus.parent.isEmbedded,
      parentName: bonus.parent.name
    });
  }

  const data = sheet.actor.getRollData();
  for (const bonus of babonus.getCollection(sheet.actor)) await _prepareBonus(bonus, data);
  for (const item of sheet.actor.items) {
    const data = item.getRollData();
    for (const bonus of babonus.getCollection(item)) await _prepareBonus(bonus, data);
    for (const effect of item.effects) for (const bonus of babonus.getCollection(effect)) {
      await _prepareBonus(bonus, data);
    }
  }
  for (const effect of sheet.actor.effects) {
    for (const bonus of babonus.getCollection(effect)) await _prepareBonus(bonus, data);
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
      const {clientX, clientY} = event;
      const target = event.currentTarget;
      const action = target.dataset.action;
      const uuid = target.closest("[data-item-uuid]")?.dataset.itemUuid;
      if (!uuid) return;
      switch (action) {
        case "toggle": return (await babonus.fromUuid(uuid)).toggle();
        case "edit": return (await babonus.fromUuid(uuid)).sheet.render(true);
        case "delete": return (await babonus.fromUuid(uuid)).deleteDialog();
        case "contextMenu":
          event.preventDefault();
          event.stopPropagation();
          return target.dispatchEvent(new PointerEvent("contextmenu", {
            view: window, bubbles: true, cancelable: true, clientX, clientY
          }));
        default: return;
      }
    });
  });

  div.firstElementChild.addEventListener("drop", async (event) => {
    const data = TextEditor.getDragEventData(event);
    if (!sheet.isEditable) return;
    const bonus = await babonus.fromUuid(data.uuid);
    if (!bonus || uuids.has(bonus.uuid)) return;
    babonus.embedBabonus(sheet.document, bonus);
  });

  div.querySelectorAll("[data-item-uuid][draggable]").forEach(n => {
    n.addEventListener("dragstart", async (event) => {
      const uuid = event.currentTarget.dataset.itemUuid;
      const bab = await babonus.fromUuid(uuid);
      const dragData = bab.toDragData();
      if (!dragData) return;
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    });
  });

  div.querySelector("[data-action='otter-dance']").addEventListener("click", (event) => {
    const spin = [{transform: "rotate(0)"}, {transform: "rotate(360deg)"}];
    const time = {duration: 1000, iterations: 1};
    if (!event.currentTarget.getAnimations().length) event.currentTarget.animate(spin, time);
  });

  div.querySelectorAll("[data-action='bonus-source']").forEach(n => {
    n.addEventListener("click", async (event) => {
      const uuid = event.currentTarget.dataset.uuid;
      const item = await fromUuid(uuid);
      return item.sheet.render(true);
    });
  });

  html.querySelector(".tab-body").appendChild(div.firstElementChild);
  html.querySelector("button.create-child").addEventListener("click", _createChildBonus.bind(sheet));

  new dnd5e.applications.ContextMenu5e(html, ".item[data-item-uuid]", [], {
    onOpen: (...args) => _onOpenContextMenu(...args)
  });
}

/* -------------------------------------------------- */

/**
 * Populate the context menu options.
 * @param {HTMLElement} element     The targeted element.
 */
function _onOpenContextMenu(element) {
  const bonus = babonus.fromUuidSync(element.dataset.itemUuid);
  ui.context.menuItems = [{
    name: "BABONUS.ContextMenu.Edit",
    icon: "<i class='fa-solid fa-edit'></i>",
    callback: () => bonus.sheet.render(true)
  }, {
    name: "BABONUS.ContextMenu.Duplicate",
    icon: "<i class='fa-solid fa-copy'></i>",
    callback: () => babonus.duplicateBonus(bonus)
  }, {
    name: "BABONUS.ContextMenu.Delete",
    icon: "<i class='fa-solid fa-trash'></i>",
    callback: () => bonus.deleteDialog()
  }, {
    name: "BABONUS.ContextMenu.Enable",
    icon: "<i class='fa-solid fa-toggle-on'></i>",
    condition: () => !bonus.enabled,
    callback: () => bonus.toggle(),
    group: "instance"
  }, {
    name: "BABONUS.ContextMenu.Disable",
    icon: "<i class='fa-solid fa-toggle-off'></i>",
    condition: () => bonus.enabled,
    callback: () => bonus.toggle(),
    group: "instance"
  }];
}

/* -------------------------------------------------- */

/**
 * Utility method that creates a popup dialog for a new bonus.
 * @this {ActorSheet5eCharacter2}
 * @returns {Promise}
 */
async function _createChildBonus() {
  if (!this.isEditable || (this._tabs[0]?.active !== MODULE.ID)) return;
  const template = "systems/dnd5e/templates/apps/document-create.hbs";
  const data = {
    folders: [],
    folder: null,
    hasFolders: false,
    name: game.i18n.localize("BABONUS.NewBabonus"),
    type: babonus.abstract.TYPES[0],
    types: babonus.abstract.TYPES.reduce((acc, type) => {
      const label = game.i18n.localize(`BABONUS.Type${type.capitalize()}.Label`);
      acc.push({
        type: type,
        label: label,
        icon: babonus.abstract.DataModels[type].metadata.defaultImg
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

/* -------------------------------------------------- */

/**
 * Add a new tab to the v2 character sheet.
 */
function _addCharacterTab() {
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
      const items = embedded.items?.flatMap(item => babonus.getCollection(item).contents) ?? [];
      const effects = embedded.effects?.flatMap(effect => babonus.getCollection(effect).contents) ?? [];
      return actor.concat(items).concat(effects);
    }
  }
  cls.prototype._filterChildren = sheet.prototype._filterChildren;
}

/* -------------------------------------------------- */

/** Initialize this part of the module. */
export default function characterSheetTabSetup() {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHEET_TAB)) return;
  if (!game.user.isGM && !game.settings.get(MODULE.ID, SETTINGS.PLAYERS)) return;
  _addCharacterTab();
  Hooks.on("renderActorSheet5eCharacter2", _onRenderCharacterSheet2);
}
