import {MODULE} from "../constants.mjs";
import {module} from "../data/_module.mjs";
import {BabonusWorkshop} from "./babonus.mjs";
import {BabonusKeysDialog} from "./keysDialog.mjs";

export class BabonusSheet extends DocumentSheet {
  /**
   * @param {Babonus} babonus         The babonus managed by this sheet.
   * @param {object} [options={}]     Optional configuration parameters for how the sheet behaves.
   */
  constructor(babonus, options = {}) {
    super(babonus, options);
    this._filters = new Set(Object.keys(babonus.toObject().filters ?? {}));
    this.appId = this.id;
    this.owner = babonus.parent;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE.ID, "sheet", "dnd5e"],
      template: "modules/babonus/templates/babonus-sheet.hbs",
      sheetConfig: true,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      tabs: [{navSelector: "nav[data-group=main]", contentSelector: "div.document-tabs"}],
      resizable: true,
      scrollY: ["[data-tab=filters]"],
      width: 500
    });
  }

  /**
   * The babonus.
   * @type {Babonus}
   */
  get document() {
    return this.object;
  }
  get bonus() {
    return this.object;
  }

  /** @override */
  get id() {
    return `babonus-sheet-${this.bonus?.uuid.replaceAll(".", "-")}`;
  }

  /** @override */
  get title() {
    return this.document.name;
  }

  /** @override */
  get isEditable() {
    return this.owner.isOwner;
  }

  /** @override */
  async getData(options = {}) {
    const context = {};
    context.bonuses = {};
    context.modifiers = this._prepareModifiers();
    const b = this.bonus.toObject().bonuses;
    for (const [key, val] of Object.entries(b)) {
      if (key !== "modifiers") context.bonuses[key] = val;
    }
    context.hasModifiers = !foundry.utils.isEmpty(context.modifiers);
    context.aura = this._prepareAura();
    context.consume = this._prepareConsume();
    context.description = await TextEditor.enrichHTML(this.bonus.description, {
      rollData: this.bonus.getRollData(), async: true
    });
    context.labels = this._prepareLabels();
    context.filters = await this._prepareFilters();
    context.filterpickers = this._prepareFilterPicker();

    return {
      bonus: this.bonus,
      editable: this.isEditable,
      filters: this._filters,
      actor: this.bonus.actor,
      item: this.bonus.item,
      template: this.bonus.template,
      effect: this.bonus.effect,
      token: this.bonus.token,
      parent: this.owner,
      type: this.bonus.type,
      context: context,
      source: this.bonus.toObject()
    };
  }

  /**
   * Prepare the filter picker.
   * @returns {object[]}
   */
  _prepareFilterPicker() {
    const keys = Object.keys(this.bonus.filters);
    return keys.reduce((acc, key) => {
      const field = module.filters[key];
      if (!this._filters.has(key) || field.repeatable) acc.push({
        id: key,
        repeats: field.repeatable ? this.bonus.filters[key].length : null
      });
      return acc;
    }, []).sort((a, b) => {
      a = game.i18n.localize(`BABONUS.Filters${a.id.capitalize()}`);
      b = game.i18n.localize(`BABONUS.Filters${b.id.capitalize()}`);
      return a.localeCompare(b);
    });
  }

  /**
   * Prepare filters.
   * @returns {Promise<string>}
   */
  async _prepareFilters() {
    const div = document.createElement("DIV");
    const keys = [...this._filters].sort((a, b) => {
      a = game.i18n.localize(`BABONUS.Filters${a.capitalize()}`);
      b = game.i18n.localize(`BABONUS.Filters${b.capitalize()}`);
      return a.localeCompare(b);
    })
    for (const key of keys) {
      const filter = module.filters[key];
      if (filter) div.innerHTML += await filter.render(this.bonus);
    }
    return div.innerHTML;
  }

  /**
   * Prepare labels.
   * @returns {string[]}
   */
  _prepareLabels() {
    const labels = [];

    labels.push(game.i18n.localize(`BABONUS.Type${this.bonus.type.capitalize()}`));

    const filters = Object.keys(this.bonus.filters).filter(key => module.filters[key].storage(this.bonus)).length;
    labels.push(game.i18n.format("BABONUS.LabelsFilters", {n: filters}));

    if (!this.bonus.enabled) labels.push(game.i18n.localize("BABONUS.LabelsDisabled"));
    if (this.bonus.isExclusive) labels.push(game.i18n.localize("BABONUS.LabelsExclusive"));
    if (this.bonus.isOptional) labels.push(game.i18n.localize("BABONUS.LabelsOptional"));
    if (this.bonus.consume.isConsuming) labels.push(game.i18n.localize("BABONUS.LabelsConsuming"));
    if (this.bonus.aura.isToken) labels.push(game.i18n.localize("BABONUS.LabelsTokenAura"));
    if (this.bonus.aura.isTemplate) labels.push(game.i18n.localize("BABONUS.LabelsTemplateAura"));

    return labels;
  }

  /**
   * Prepare consumption data.
   * @returns {object}
   */
  _prepareConsume() {
    const consume = this.bonus.consume;

    // Construct subtypes.
    const subtypes = {};
    if (consume.type === "currency") {
      Object.entries(CONFIG.DND5E.currencies).sort((a, b) => b[1].conversion - a[1].conversion).forEach(c => {
        subtypes[c[0]] = c[1].label;
      });
    } else if (consume.type === "resource") {
      ["primary", "secondary", "tertiary"].forEach(p => subtypes[p] = `BABONUS.ConsumptionTypeResource${p.capitalize()}`);
    }
    const isSlot = consume.type === "slots";

    return {
      enabled: consume.enabled,
      choices: consume.OPTIONS,
      cannotScale: ["effect", "inspiration"].includes(consume.type),
      isSlot: isSlot,
      showStep: ["health", "currency", "resource"].includes(consume.type) && consume.scales,
      showFormula: consume.scales,
      showMax: consume.scales,
      showSubtype: !foundry.utils.isEmpty(subtypes),
      subtypeLabel: `BABONUS.ConsumptionType${consume.type.capitalize()}Subtype`,
      subtypeOptions: subtypes,
      labelMin: isSlot ? "BABONUS.Smallest" : "Minimum",
      labelMax: isSlot ? "BABONUS.Largest" : "Maximum",
      isInvalid: consume.enabled && !consume.isConsuming
    };
  }

  /**
   * Prepare aura data.
   * @returns {object}
   */
  _prepareAura() {
    const aura = this.bonus.aura;
    const isItem = this.owner instanceof Item;
    const choices = Object.entries(module.fields.aura.OPTIONS).reduce((acc, [k, v]) => {
      acc[v] = `BABONUS.ConfigurationAuraDisposition${k.titleCase()}`;
      return acc;
    }, {});

    return {
      showRange: !aura.template,
      displayedRange: (aura.range > 0) ? aura.range : (aura.range === -1) ? game.i18n.localize("DND5E.Unlimited") : 0,
      choices: choices,
      blockers: aura.blockers.join(";"),
      isItem: isItem,
      isInvalid: aura.enabled && !(aura.isTemplate || aura.isToken),
      invalidTemplate: !isItem
    };
  }

  /**
   * Prepare bonuses modifiers for rendering.
   * @returns {object}
   */
  _prepareModifiers() {
    const modifiers = this.bonus.toObject().bonuses.modifiers ?? {};
    const data = {};
    for (const key in modifiers) {
      const v = modifiers[key];
      data[key] = {
        key: key,
        enabled: v.enabled,
        disabled: !v.enabled,
        ...v
      };
    }
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-action='keys-dialog']").forEach(n => {
      n.addEventListener("click", this._onDisplayKeysDialog.bind(this));
    });
    html[0].querySelectorAll("input[type=text], input[type=number]").forEach(n => {
      n.addEventListener("focus", event => event.currentTarget.select());
    });
    html[0].querySelectorAll("[data-action='add-filter']").forEach(n => {
      n.addEventListener("click", this._onClickAddFilter.bind(this));
    });
    html[0].querySelectorAll("[data-action='delete-filter']").forEach(n => {
      n.addEventListener("click", this._onClickDeleteFilter.bind(this));
    });
  }

  /**
   * Handle deleting a filter.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onClickDeleteFilter(event) {
    const id = event.currentTarget.dataset.id;
    const field = module.filters[id];
    if (!field.repeatable) {
      this._filters.delete(id);
      return this.owner.update({[`flags.babonus.bonuses.${this.bonus.id}.filters.-=${id}`]: null});
    } else {
      const arr = this.bonus.filters[id];
      const idx = event.currentTarget.dataset.idx;
      arr.splice(idx, 1);
      return this.owner.update({[`flags.babonus.bonuses.${this.bonus.id}.filters.${id}`]: arr});
    }
  }

  /**
   * Handle adding a filter.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onClickAddFilter(event) {
    const id = event.currentTarget.dataset.id;
    this._filters.add(id);
    const field = module.filters[id];
    if (field.repeatable) {
      const arr = this.bonus.filters[id].concat({});
      return this.owner.update({[`flags.babonus.bonuses.${this.bonus.id}.filters.${id}`]: arr});
    }
    return this.render();
  }

  /**
   * Helper function to display the keys dialog and update the corresponding filter value.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onDisplayKeysDialog(event) {
    const filterId = event.currentTarget.dataset.id;
    const filter = module.filters[filterId];
    const property = event.currentTarget.dataset.property;
    const list = await filter.choices();
    const canExclude = filter.canExclude;
    const values = foundry.utils.getProperty(this.bonus, property);
    const bonus = this.bonus;
    const owner = this.owner;

    for (const value of values) {
      const key = value.replaceAll("!", "");
      const val = list.find(e => e.value === key);
      if (!val) continue;
      if (value.startsWith("!")) val.exclude = true;
      else val.include = true;
    }

    return BabonusKeysDialog.prompt({
      rejectClose: false,
      options: {filterId, appId: this.appId, values: list, canExclude},
      callback: async function(html) {
        const values = [];
        html[0].querySelectorAll("select").forEach(s => {
          if (s.value === "include") values.push(s.dataset.value);
          else if (s.value === "exclude") values.push("!" + s.dataset.value);
        });
        bonus.updateSource({[property]: values});
        return BabonusWorkshop._embedBabonus(owner, bonus, true);
      },
    });
  }

  /** @override */
  setPosition(pos = {}) {
    if (this._tabs[0].active !== "filters") pos.height = "auto";
    return super.setPosition(pos);
  }

  /** @override */
  _createDocumentIdLink(html) {
    const title = html[0].querySelector(".window-title");
    const label = game.i18n.localize(this.document.constructor.metadata.label);
    const idLink = document.createElement("A");
    idLink.classList.add("document-id-link");
    idLink.dataset.tooltip = `${label}: ${this.document.id}`;
    idLink.dataset.tooltipDirection = "UP";
    idLink.innerHTML = '<i class="fa-solid fa-passport"></i>';
    idLink.addEventListener("click", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.document.id);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
        label, type: "id", id: this.document.id
      }));
    });
    idLink.addEventListener("contextmenu", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.document.uuid);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
        label, type: "uuid", id: this.document.uuid
      }));
    });
    title.append(idLink);
  }

  /** @override */
  async _updateObject(event, formData) {
    try {
      this.bonus.updateSource(formData);
    } catch (err) {
      ui.notifications.error(err);
      return this.render()
    }
    return BabonusWorkshop._embedBabonus(this.owner, this.bonus, true);
  }

  /** @override */
  render(force = false, options = {}) {
    this.object = babonus.getCollection(this.owner).get(this.bonus.id);
    if (!this.object) return this.close({submit: false});
    options.editable = options.editable ?? this.bonus.isOwner;
    this.owner.apps[this.appId] = this;
    return super.render(force, options);
  }

  /** @override */
  async close(options = {}) {
    delete this.owner?.apps[this.appId];
    if (!this.object) options.submit = false;
    return super.close(options);
  }
}
