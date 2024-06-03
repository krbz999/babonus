import {MODULE} from "../constants.mjs";

const {HandlebarsApplicationMixin, DocumentSheetV2} = foundry.applications.api;

export class BabonusSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  /**
   * @param {Babonus} bonus        The babonus managed by this sheet.
   * @param {object} [options]     Optional configuration parameters for how the sheet behaves.
   */
  constructor(bonus, options = {}) {
    super({...options, document: bonus.parent, bonus: bonus});

    const ids = new Set(Object.keys(bonus.toObject().filters)).filter(id => {
      return babonus.abstract.DataFields.filters[id].storage(bonus);
    });

    /**
     * The filters that are currently active.
     * @type {Set<string>}
     */
    this._filters = ids;
    this.bonus = bonus;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [MODULE.ID, "sheet"],
    sheetConfig: false,
    window: {
      icon: "fa-solid fa-otter",
      resizable: false,
      contentClasses: ["standard-form"]
    },
    position: {
      width: 600,
      height: "auto"
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      keysDialog: this._onKeysDialog,
      addFilter: this._onAddFilter,
      deleteFilter: this._onDeleteFilter,
      copyUuid: {handler: this._onCopyUuid, buttons: [0, 2]},
      editImage: this._onEditImage
    }
  };

  /** @override */
  static PARTS = {
    header: {template: "modules/babonus/templates/sheet-header.hbs"},
    navigation: {template: "modules/babonus/templates/sheet-navigation.hbs"},
    description: {template: "modules/babonus/templates/sheet-description.hbs", scrollable: [""]},
    bonuses: {template: "modules/babonus/templates/sheet-bonuses.hbs", scrollable: [""]},
    configuration: {template: "modules/babonus/templates/sheet-configuration.hbs", scrollable: [""]},
    filters: {template: "modules/babonus/templates/sheet-filters.hbs", scrollable: [""]},
    advanced: {template: "modules/babonus/templates/sheet-advanced.hbs", scrollable: [""]}
  };

  /** @override */
  tabGroups = {
    main: "description"
  };

  /**
   * The babonus.
   * @type {Babonus}
   */
  get bonus() {
    return this.#bonus;
  }
  set bonus(b) {
    this.#bonus = b;
  }
  #bonus = null;

  /** @override */
  get title() {
    return this.bonus.name;
  }

  /** @override */
  get isEditable() {
    return super.isEditable && !!this.bonus?.parent?.isOwner;
  }

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.uniqueId = `${this.constructor.name}-${options.bonus.uuid}`;
    return options;
  }

  /** @override */
  _prepareSubmitData(event, form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);
    this.bonus.validate({changes: submitData, clean: true, fallback: false});
    submitData.id = this.bonus.id;
    const collection = babonus.getCollection(this.document).contents.map(k => k.toObject());
    this.bonus.updateSource(submitData);
    collection.findSplice(k => k.id === this.bonus.id, this.bonus.toObject());
    return {flags: {babonus: {bonuses: collection}}};
  }

  /* ------------------------------- */
  /*                                 */
  /* Rendering                       */
  /*                                 */
  /* ------------------------------- */

  /** @override */
  render(...T) {
    const bonus = babonus.getCollection(this.document).get(this.bonus.id);
    if (!bonus) return this.close();
    this.bonus = bonus;
    return super.render(...T);
  }

  /** @override */
  _onRender(...T) {
    super._onRender(...T);

    const element = this.element.querySelector(".example");
    const replacement = this.element.querySelector("#example");
    const options = {
      root: element.closest(".tab.scrollable"),
      rootMargin: "0px",
      threshold: 0.5
    };
    new IntersectionObserver(([{target, isIntersecting}], observer) => {
      if (this.tabGroups.main !== "bonuses") isIntersecting = true;
      replacement.classList.toggle("expanded", !isIntersecting);
      replacement.classList.remove("inst");
    }, options).observe(element);
  }

  /** @override */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    if (partId === "bonuses") {
      if (priorElement.querySelector("#example").classList.contains("expanded")) {
        newElement.querySelector("#example").classList.add("expanded", "inst");
      }
    }
  }

  /** @override */
  async _prepareContext(options) {
    const rollData = this.bonus.getRollData();

    const tabs = {
      description: {
        icon: "fa-solid fa-pen-fancy",
        label: "BABONUS.SheetTabs.Description"
      },
      bonuses: {
        icon: "fa-solid fa-dice",
        label: "BABONUS.SheetTabs.Bonuses"
      },
      configuration: {
        icon: "fa-solid fa-wrench",
        label: "BABONUS.SheetTabs.Configuration"
      },
      filters: {
        icon: "fa-solid fa-plug",
        label: "BABONUS.SheetTabs.Filters"
      },
      advanced: {
        icon: "fa-solid fa-cubes",
        label: "BABONUS.SheetTabs.Advanced"
      }
    };
    for (const [k, v] of Object.entries(tabs)) {
      v.cssClass = (this.tabGroups.main === k) ? "active" : "";
      v.id = k;
    }

    const context = {};
    context.bonuses = this._prepareBonuses();
    context.modifiers = this._prepareModifiers(rollData);
    context.hasModifiers = !foundry.utils.isEmpty(context.modifiers);
    context.aura = this._prepareAura();
    context.consume = this._prepareConsume();
    context.description = {
      enriched: await TextEditor.enrichHTML(this.bonus.description, {
        rollData: rollData, async: true, relativeTo: this.bonus.origin
      }),
      field: this.bonus.schema.getField("description"),
      value: this.bonus.description,
      height: 400
    };
    context.labels = this._prepareLabels();
    context.filters = this._prepareFilters();
    context.filterpickers = this._prepareFilterPicker();
    context.tabs = tabs;

    // Root fields.
    context.checks = {
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
      context: context,
      rootId: this.bonus.id
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

    labels.push(game.i18n.localize(`BABONUS.Type${this.bonus.type.capitalize()}.Label`));

    const filterLabels = Object.keys(this.bonus.filters).filter(key => {
      return babonus.abstract.DataFields.filters[key].storage(this.bonus);
    }).length;
    labels.push(game.i18n.format("BABONUS.Labels.Filters", {n: filterLabels}));

    if (!this.bonus.enabled) labels.push(game.i18n.localize("BABONUS.Labels.Disabled"));
    if (this.bonus.isExclusive) labels.push(game.i18n.localize("BABONUS.Labels.Exclusive"));
    if (this.bonus.isOptional) labels.push(game.i18n.localize("BABONUS.Labels.Optional"));
    if (this.bonus.consume.isValidConsumption) labels.push(game.i18n.localize("BABONUS.Labels.Consuming"));
    if (this.bonus.aura.isToken) labels.push(game.i18n.localize("BABONUS.Labels.TokenAura"));
    if (this.bonus.aura.isTemplate) labels.push(game.i18n.localize("BABONUS.Labels.TemplateAura"));
    if (this.bonus.isReminder) labels.push(game.i18n.localize("BABONUS.Labels.Reminder"));

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
        label: `BABONUS.Fields.Consume.Subtype.${source.type.capitalize()}Label`,
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

  /* ------------------------------- */
  /*                                 */
  /* Event handlers                  */
  /*                                 */
  /* ------------------------------- */

  /**
   * Handle deleting a filter.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static _onDeleteFilter(event, target) {
    const id = target.dataset.id;
    const data = this.bonus.toObject();

    if (babonus.abstract.DataFields.filters[id].repeatable) {
      const idx = parseInt(target.dataset.idx);
      const property = foundry.utils.deepClone(data.filters[id]);
      property.splice(idx, 1);
      if (!property.length) delete data.filters[id];
      data.filters[id] = property;
    } else {
      this._filters.delete(id);
      delete data.filters[id];
    }

    const collection = babonus.getCollection(this.document).contents.map(k => k.toObject());
    collection.findSplice(k => k.id === this.bonus.id, data);
    this.document.update({"flags.babonus.bonuses": collection});
  }

  /**
   * Handle adding a filter.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static _onAddFilter(event, target) {
    const id = target.dataset.id;
    this._filters.add(id);
    if (babonus.abstract.DataFields.filters[id].repeatable) {
      const data = this.bonus.toObject();
      data.filters[id].push({});
      const collection = babonus.getCollection(this.document).contents.map(k => k.toObject());
      collection.findSplice(k => k.id === this.bonus.id, data);
      this.document.update({"flags.babonus.bonuses": collection});
    } else {
      this.render();
    }
  }

  /**
   * Helper function to display the keys dialog and update the corresponding filter value.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static _onKeysDialog(event, target) {
    const bonus = this.bonus;
    const filterId = target.dataset.id;
    const filter = babonus.abstract.DataFields.filters[filterId];
    const property = target.dataset.property;
    const list = filter.choices();
    const values = foundry.utils.getProperty(bonus, property);

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

    babonus.abstract.applications.KeysDialog.prompt({
      ok: {
        label: "BABONUS.KeysDialogApplySelection",
        icon: "fa-solid fa-check",
        callback: async function(event, button, html) {
          const values = [];
          html.querySelectorAll(".table .select select").forEach(s => {
            if (s.value === "include") values.push(s.dataset.value);
            else if (s.value === "exclude") values.push("!" + s.dataset.value);
          });
          bonus.update({[property]: values});
        }
      },
      filterId: filterId,
      values: categories.length ? categories.concat(list) : list,
      canExclude: filter.canExclude
    });
  }

  /**
   * Copy the uuid or id of the bonus.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static _onCopyUuid(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks
    const id = (event.button === 2) ? this.bonus.id : this.bonus.uuid;
    const type = (event.button === 2) ? "id" : "uuid";
    const label = game.i18n.localize(this.bonus.constructor.metadata.label);
    game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {label, type, id}));
  }

  /**
   * Change the image of the bonus.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static _onEditImage(event, target) {
    new FilePicker({
      type: "image",
      current: this.bonus.img,
      allowUpload: false,
      callback: src => this.bonus.update({img: src})
    }).browse();
  }

}
