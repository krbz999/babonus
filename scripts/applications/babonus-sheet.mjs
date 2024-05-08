import {MODULE} from "../constants.mjs";
import {module} from "../data/_module.mjs";
import {BabonusWorkshop} from "./babonus-workshop.mjs";
import {KeysDialog} from "./keys-dialog.mjs";

export class BabonusSheet extends dnd5e.applications.DialogMixin(DocumentSheet) {
  /**
   * @param {Babonus} bonus        The babonus managed by this sheet.
   * @param {object} [options]     Optional configuration parameters for how the sheet behaves.
   */
  constructor(bonus, options = {}) {
    super(bonus, options);

    const ids = new Set(Object.keys(bonus.toObject().filters)).filter(id => module.filters[id].storage(bonus));
    this._filters = ids;
    this.appId = this.id;
    this.owner = bonus.parent;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE.ID, "sheet", "dnd5e2"],
      template: "modules/babonus/templates/babonus-sheet.hbs",
      sheetConfig: true,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      tabs: [{navSelector: "nav[data-group=main]", contentSelector: "div.document-tabs"}],
      resizable: true,
      scrollY: ["[data-tab=filters]"],
      width: 500,
      height: null
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
    const rollData = this.bonus.getRollData();

    const context = {};
    context.bonuses = this._prepareBonuses();
    context.modifiers = this._prepareModifiers(rollData);
    context.hasModifiers = !foundry.utils.isEmpty(context.modifiers);
    context.aura = this._prepareAura();
    context.consume = this._prepareConsume();
    context.description = await TextEditor.enrichHTML(this.bonus.description, {
      rollData: rollData, async: true, relativeTo: this.bonus.origin
    });
    context.labels = this._prepareLabels();
    context.filters = await this._prepareFilters();
    context.filterpickers = this._prepareFilterPicker();
    context.modifierOptions = Object.entries(module.fields.modifiers.MODIFIER_MODES).reduce((acc, [k, v]) => {
      acc[v] = `BABONUS.ModifiersMode${k.titleCase()}`;
      return acc;
    }, {});

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
      source: this.bonus.toObject(),
      config: CONFIG.DND5E
    };
  }

  /**
   * Prepare the bonuses.
   * @returns {object[]}
   */
  _prepareBonuses() {
    const b = Object.entries(this.bonus.toObject().bonuses);
    const bonuses = [];
    const type = this.bonus.type;
    b.forEach(([k, v]) => {
      if ((k === "modifiers") || (k === "damageType")) return;
      bonuses.push({
        key: k,
        value: v,
        hint: `BABONUS.Type${type.capitalize()}${k.capitalize()}Tooltip`,
        label: `BABONUS.Type${type.capitalize()}${k.capitalize()}Label`,
        isDamage: (type === "damage") && (k === "bonus"),
        selected: this.bonus.bonuses.damageType
      });
    });
    return bonuses;
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
        repeats: field.repeatable ? this.bonus.filters[key].length : null,
        label: `BABONUS.Filters${key.capitalize()}`,
        hint: `BABONUS.Filters${key.capitalize()}Tooltip`
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
    });
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
    if (this.bonus.consume.isValidConsumption) labels.push(game.i18n.localize("BABONUS.LabelsConsuming"));
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
    const v = consume.value;

    // Construct subtypes.
    const subtypes = {};
    if (consume.type === "currency") {
      Object.entries(CONFIG.DND5E.currencies).sort((a, b) => b[1].conversion - a[1].conversion).forEach(c => {
        subtypes[c[0]] = c[1].label;
      });
    } else if (consume.type === "hitdice") {
      subtypes.smallest = "DND5E.ConsumeHitDiceSmallest";
      subtypes.largest = "DND5E.ConsumeHitDiceLargest";
      for (const d of CONFIG.DND5E.hitDieTypes) subtypes[d] = d;
    }
    const isSlot = consume.type === "slots";

    return {
      enabled: consume.enabled,
      choices: {
        currency: "DND5E.Currency",
        effect: "BABONUS.ConsumptionTypeEffect",
        health: "DND5E.HitPoints",
        hitdice: "DND5E.HitDice",
        inspiration: "DND5E.Inspiration",
        quantity: "DND5E.Quantity",
        slots: "BABONUS.ConsumptionTypeSlots",
        uses: "DND5E.LimitedUses"
      },
      cannotScale: ["effect", "inspiration"].includes(consume.type),
      isSlot: isSlot,
      showStep: ["health", "currency"].includes(consume.type) && consume.scales,
      showFormula: consume.scales,
      showMax: consume.scales,
      showSubtype: !foundry.utils.isEmpty(subtypes),
      subtypeLabel: `BABONUS.ConsumptionType${consume.type.capitalize()}Subtype`,
      subtypeOptions: subtypes,
      labelMin: isSlot ? "BABONUS.Smallest" : "Minimum",
      labelMax: isSlot ? "BABONUS.Largest" : "Maximum",
      isInvalid: consume.enabled && !consume.isValidConsumption,
      source: consume.toObject(),
      consumeRange: (v.max && v.min) ? `(${v.min}&ndash;${v.max})` : null
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
      blockers: Array.from(aura.blockers).filterJoin(";"),
      isItem: isItem,
      isInvalid: aura.enabled && !(aura.isTemplate || aura.isToken),
      invalidTemplate: !isItem
    };
  }

  /**
   * Prepare bonuses modifiers for rendering.
   * @param {object} rollData     The roll data of the bonus,
   * @returns {object}
   */
  _prepareModifiers(rollData) {
    const modifiers = this.bonus.toObject().bonuses.modifiers;
    if (!modifiers) return;
    const mods = this.bonus.bonuses.modifiers;
    const data = {};
    const parts = ["2d10", "1d4"];
    mods.modifyParts(parts, rollData);
    data.example = parts.join(" + ");
    for (const [key, v] of Object.entries(modifiers)) {
      data[key] = {
        ...v,
        key: key,
        enabled: v.enabled,
        disabled: !v.enabled
      };
    }
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html = html[0];
    html.querySelectorAll("[data-action='keys-dialog']").forEach(n => {
      n.addEventListener("click", this._onDisplayKeysDialog.bind(this));
    });
    html.querySelectorAll("input[type=text], input[type=number]").forEach(n => {
      n.addEventListener("focus", event => event.currentTarget.select());
    });
    html.querySelectorAll("[data-action='add-filter']").forEach(n => {
      n.addEventListener("click", this._onClickAddFilter.bind(this));
    });
    html.querySelectorAll("[data-action='delete-filter']").forEach(n => {
      n.addEventListener("click", this._onClickDeleteFilter.bind(this));
    });
  }

  /**
   * Handle deleting a filter.
   * @param {Event} event                                   The initiating click event.
   * @returns {Promise<Actor5e|Item5e|ActiveEffect5e>}      A promise that resolves to the updated owner of the bonus.
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
   * @param {Event} event     The initiating click event.
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
   * @param {Event} event     The initiating click event.
   */
  async _onDisplayKeysDialog(event) {
    const bonus = this.bonus;
    const filterId = event.currentTarget.dataset.id;
    const filter = module.filters[filterId];
    const property = event.currentTarget.dataset.property;
    const list = await filter.choices();
    const values = foundry.utils.getProperty(bonus, property);
    const owner = this.owner;

    for (const value of values) {
      const key = value.replaceAll("!", "");
      const val = list.find(e => e.value === key);
      if (!val) continue;
      if (value.startsWith("!")) val.exclude = true;
      else val.include = true;
    }

    const types = {
      baseWeapons: CONFIG.DND5E.weaponTypes,
      baseArmors: CONFIG.DND5E.armorTypes,
      baseTools: CONFIG.DND5E.toolTypes
    }[filterId] ?? null;

    const categories = [];
    if (types) {
      for (const [k, v] of Object.entries(types)) {
        const val = values.find(v => v.replaceAll("!", "") === k);
        categories.push({
          isCategory: true,
          exclude: val ? val.startsWith("!") : false,
          include: val ? !val.startsWith("!") : false,
          value: k,
          label: v
        });
      }
    }

    return KeysDialog.prompt({
      rejectClose: false,
      options: {
        filterId: filterId,
        appId: this.appId,
        values: categories.length ? categories.concat(list) : list,
        canExclude: filter.canExclude
      },
      callback: async function(html) {
        const values = [];
        html[0].querySelectorAll("select").forEach(s => {
          if (s.value === "include") values.push(s.dataset.value);
          else if (s.value === "exclude") values.push("!" + s.dataset.value);
        });
        bonus.updateSource({[property]: values});
        return BabonusWorkshop._embedBabonus(owner, bonus, true);
      }
    });
  }

  /** @override */
  _createDocumentIdLink(html) {
    const label = game.i18n.localize(this.document.constructor.metadata.label);
    const idLink = document.createElement("A");
    idLink.classList.add("document-id-link");
    idLink.dataset.tooltip = `${label}: ${this.document.id}`;
    idLink.dataset.tooltipDirection = "DOWN";
    idLink.innerHTML = "<i class=\"fa-solid fa-passport\"></i>";
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
    html[0].querySelector(".header-button.close").before(idLink);
  }

  /** @override */
  async _updateObject(event, formData) {
    try {
      const obj = this.bonus.updateSource(formData);
      if (foundry.utils.isEmpty(obj)) return this.render();
    } catch (err) {
      ui.notifications.error(err);
      return this.render();
    }
    return BabonusWorkshop._embedBabonus(this.owner, this.bonus, true, this._filters);
  }

  /** @override */
  render(force = false, options = {}) {
    const object = babonus.getCollection(this.owner).get(this.bonus.id);
    if (!object) return this.close({submit: false});
    this.object = object;
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

  /** @override */
  _onChangeTab(event, tabs, active) {
    this.setPosition({height: "auto"});
  }

  /** @override */
  async _render(...args) {
    const result = await super._render(...args);
    try {
      this.setPosition({height: "auto"});
    } catch (err) {
      //
    }
    return result;
  }
}
