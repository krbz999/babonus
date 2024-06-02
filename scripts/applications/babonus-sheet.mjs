import {MODULE} from "../constants.mjs";

export class BabonusSheet extends dnd5e.applications.DialogMixin(DocumentSheet) {
  /**
   * @param {Babonus} bonus        The babonus managed by this sheet.
   * @param {object} [options]     Optional configuration parameters for how the sheet behaves.
   */
  constructor(bonus, options = {}) {
    super(bonus, options);

    const ids = new Set(Object.keys(bonus.toObject().filters)).filter(id => {
      return babonus.abstract.DataFields.filters[id].storage(bonus);
    });

    /**
     * The filters that are currently active.
     * @type {Set<string>}
     */
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
      scrollY: [
        ".document-tabs [data-tab=bonuses]",
        ".document-tabs [data-tab=configuration]",
        ".document-tabs [data-tab=filters]",
        ".document-tabs [data-tab=advanced]"
      ],
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
    context.filters = this._prepareFilters();
    context.filterpickers = this._prepareFilterPicker();

    // Root fields.
    context.root = {
      enabled: {
        field: this.bonus.schema.getField("enabled"),
        value: this.bonus.enabled
      },
      exclusive: {
        field: this.bonus.schema.getField("exclusive"),
        value: this.bonus.exclusive
      },
      optional: {
        field: this.bonus.schema.getField("optional"),
        value: this.bonus.optional
      },
      reminder: {
        field: this.bonus.schema.getField("reminder"),
        value: this.bonus.reminder,
        disabled: !this.bonus.canRemind
      }
    };

    return {
      bonus: this.bonus,
      editable: this.isEditable,
      filters: this._filters,
      context: context
    };
  }

  /**
   * Prepare the bonuses.
   * @returns {object[]}
   */
  _prepareBonuses() {
    const b = Object.entries(this.bonus.toObject().bonuses);
    const schema = this.bonus.schema;
    const bonuses = [];
    b.forEach(([k, v]) => {
      if (k === "modifiers") return;
      const bonusData = {
        field: schema.getField(`bonuses.${k}`),
        value: v
      };
      if (k === "damageType") {
        bonusData.isDamage = true;
        bonusData.blank = "DND5E.None";
        bonusData.options = [];
        bonusData.groups = ["DND5E.Damage", "DND5E.Healing"];

        for (const [k, v] of Object.entries(CONFIG.DND5E.damageTypes)) {
          bonusData.options.push({group: "DND5E.Damage", value: k, label: v.label});
        }
        for (const [k, v] of Object.entries(CONFIG.DND5E.healingTypes)) {
          bonusData.options.push({group: "DND5E.Healing", value: k, label: v.label});
        }
      }
      bonuses.push(bonusData);
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
      if (!this._filters.has(key) || babonus.abstract.DataFields.filters[key].repeatable) acc.push({
        id: key,
        repeats: babonus.abstract.DataFields.filters[key].repeatable ? this.bonus.filters[key].length : null,
        label: `BABONUS.Filters.${key.capitalize()}.Label`,
        hint: `BABONUS.Filters.${key.capitalize()}.Hint`
      });
      return acc;
    }, []).sort((a, b) => {
      a = game.i18n.localize(`BABONUS.Filters.${a.id.capitalize()}.Label`);
      b = game.i18n.localize(`BABONUS.Filters.${b.id.capitalize()}.Label`);
      return a.localeCompare(b);
    });
  }

  /**
   * Prepare filters.
   * @returns {string}
   */
  _prepareFilters() {
    const div = document.createElement("DIV");
    const keys = [...this._filters].sort((a, b) => {
      a = game.i18n.localize(`BABONUS.Filters.${a.capitalize()}.Label`);
      b = game.i18n.localize(`BABONUS.Filters.${b.capitalize()}.Label`);
      return a.localeCompare(b);
    });
    for (const key of keys) {
      const filter = babonus.abstract.DataFields.filters[key];
      if (filter) div.innerHTML += filter.render(this.bonus);
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

    const filterLabels = Object.keys(this.bonus.filters).filter(key => {
      return babonus.abstract.DataFields.filters[key].storage(this.bonus);
    }).length;
    labels.push(game.i18n.format("BABONUS.LabelsFilters", {n: filterLabels}));

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
    const v = this.bonus.consume.value;
    const isSlot = this.bonus.consume.type === "slots";
    const schema = this.bonus.schema;
    const scales = this.bonus.consume.scales;

    const source = this.bonus.consume.toObject();

    const context = {
      enabled: {
        field: schema.getField("consume.enabled"),
        value: source.enabled
      },
      type: {
        field: schema.getField("consume.type"),
        value: source.type
      },
      subtype: {
        field: schema.getField("consume.subtype"),
        label: `BABONUS.ConsumptionType${source.type.capitalize()}Subtype`,
        value: source.subtype
      },
      formula: {
        field: schema.getField("consume.formula"),
        placeholder: this.bonus.bonuses.bonus,
        show: scales,
        value: source.formula
      },
      step: {
        field: schema.getField("consume.value.step"),
        show: ["health", "currency"].includes(source.type) && scales,
        value: source.value.step
      },
      values: {
        field1: schema.getField("consume.value.min"),
        field2: schema.getField("consume.value.max"),
        label: `BABONUS.Fields.Consume.Values.Label${isSlot ? "Slot" : ""}`,
        ph1: game.i18n.localize(`BABONUS.Fields.Consume.Values.Min${isSlot ? "Slot" : ""}`),
        ph2: game.i18n.localize(`BABONUS.Fields.Consume.Values.Max${isSlot ? "Slot" : ""}`),
        hint: `BABONUS.Fields.Consume.Values.Hint${scales ? "Scale" : ""}${isSlot ? "Slot" : ""}`,
        range: (scales && v.max && v.min) ? `(${v.min}&ndash;${v.max})` : null,
        value1: source.value.min,
        value2: source.value.max
      },
      scale: {
        field: schema.getField("consume.scales"),
        value: source.scales,
        unavailable: !source.type || ["effect", "inspiration"].includes(source.type)
      }
    };

    const subtypes = {};
    switch (source.type) {
      case "currency": {
        Object.entries(CONFIG.DND5E.currencies).sort((a, b) => b[1].conversion - a[1].conversion).forEach(c => {
          subtypes[c[0]] = c[1].label;
        });
        break;
      }
      case "hitdice": {
        subtypes.smallest = "DND5E.ConsumeHitDiceSmallest";
        subtypes.largest = "DND5E.ConsumeHitDiceLargest";
        for (const d of CONFIG.DND5E.hitDieTypes) subtypes[d] = d;
        break;
      }
      default: break;
    }

    context.subtype.choices = subtypes;
    context.subtype.show = !foundry.utils.isEmpty(subtypes);

    return context;
  }

  /**
   * Prepare aura data.
   * @returns {object}
   */
  _prepareAura() {
    const schema = this.bonus.aura.schema;
    const src = this.bonus.aura.toObject();
    const range = this.bonus.aura.range;
    const context = {};

    // Enabled
    context.enabled = {
      field: schema.getField("enabled"),
      value: this.bonus.aura.enabled
    };

    // Range
    context.range = {
      field: schema.getField("range"),
      value: src.range
    };
    if (!range || (range > 0)) {
      context.range.label = game.i18n.format("BABONUS.Fields.Aura.Range.LabelFt", {range: range || 0});
    } else if (range === -1) {
      context.range.label = game.i18n.format("BABONUS.Fields.Aura.Range.LabelUnlimited", {
        range: game.i18n.localize("DND5E.Unlimited")
      });
    }

    // Template
    context.template = {
      field: schema.getField("template"),
      value: this.bonus.aura.template
    };

    // Targets
    context.disposition = {
      field: schema.getField("disposition"),
      value: this.bonus.aura.disposition
    };

    // Self
    context.self = {
      field: schema.getField("self"),
      value: this.bonus.aura.self
    };

    // Blockers
    context.blockers = {
      field: schema.getField("blockers"),
      value: this.bonus.aura.blockers
    };

    // Requirements
    context.requirements = ["move", "light", "sight", "sound"].map(k => {
      return {field: schema.getField(`require.${k}`), value: this.bonus.aura.require[k]};
    });

    return context;
  }

  /**
   * Prepare bonuses modifiers for rendering.
   * @param {object} rollData     The roll data of the bonus,
   * @returns {object}
   */
  _prepareModifiers(rollData) {
    const src = this.bonus.toObject();
    if (!src.bonuses?.modifiers) return;

    const makeField = path => {
      const field = this.bonus.schema.getField(path);
      const value = foundry.utils.getProperty(src, path);
      return {field, value};
    };

    const paths = Object.keys(foundry.utils.flattenObject(this.bonus.bonuses.modifiers.schema.initial()));

    const context = {};
    for (const path of paths) {
      const props = path.split(".");
      const key = props.shift();
      context[key] ??= {};
      context[key][props.pop()] = makeField(`bonuses.modifiers.${path}`);
    }

    const parts = ["2d10", "1d4"];
    this.bonus.bonuses.modifiers.modifyParts(parts, rollData);
    context.config.example = parts.join(" + ");

    return context;
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
    if (!babonus.abstract.DataFields.filters[id].repeatable) {
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
    if (babonus.abstract.DataFields.filters[id].repeatable) {
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
    const filter = babonus.abstract.DataFields.filters[filterId];
    const property = event.currentTarget.dataset.property;
    const list = filter.choices();
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

    return babonus.abstract.applications.KeysDialog.prompt({
      ok: {
        label: "BABONUS.KeysDialogApplySelection",
        icon: "fa-solid fa-check",
        callback: async function(event, button, html) {
          const values = [];
          html.querySelectorAll(".table .select select").forEach(s => {
            if (s.value === "include") values.push(s.dataset.value);
            else if (s.value === "exclude") values.push("!" + s.dataset.value);
          });
          bonus.updateSource({[property]: values});
          return babonus.abstract.applications.BabonusWorkshop._embedBabonus(owner, bonus, true);
        }
      },
      filterId: filterId,
      values: categories.length ? categories.concat(list) : list,
      canExclude: filter.canExclude
    });
  }

  /** @override */
  _createDocumentIdLink(html) {
    const label = game.i18n.localize(this.document.constructor.metadata.label);
    const idLink = document.createElement("A");
    idLink.classList.add("document-id-link");
    idLink.dataset.tooltip = "SHEETS.CopyUuid";
    idLink.dataset.tooltipDirection = "DOWN";
    idLink.innerHTML = "<i class=\"fa-solid fa-passport\"></i>";
    idLink.addEventListener("click", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.document.uuid);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
        label, type: "uuid", id: this.document.uuid
      }));
    });
    idLink.addEventListener("contextmenu", event => {
      event.preventDefault();
      game.clipboard.copyPlainText(this.document.id);
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
        label, type: "id", id: this.document.id
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
    return babonus.abstract.applications.BabonusWorkshop._embedBabonus(this.owner, this.bonus, true, this._filters);
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
}
