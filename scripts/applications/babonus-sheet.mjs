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
    this.#bonus = bonus;
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
      keysDialog: this.#onKeysDialog,
      addFilter: this.#onAddFilter,
      deleteFilter: this.#onDeleteFilter,
      copyUuid: {handler: this.#onCopyUuid, buttons: [0, 2]},
      viewFilter: this.#onViewFilter
    }
  };

  /** @override */
  static PARTS = {
    header: {template: "modules/babonus/templates/sheet-header.hbs"},
    navigation: {template: "modules/babonus/templates/sheet-navigation.hbs"},
    description: {template: "modules/babonus/templates/sheet-description.hbs", scrollable: [""]},
    bonuses: {template: "modules/babonus/templates/sheet-bonuses.hbs", scrollable: [""]},
    configuration: {template: "modules/babonus/templates/sheet-configuration.hbs", scrollable: [""]},
    filters: {template: "modules/babonus/templates/sheet-filters.hbs", scrollable: [".toc", ".picker"]},
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
  #bonus = null;

  /** @override */
  get title() {
    return `${game.i18n.localize("BABONUS.ModuleTitle")}: ${this.bonus.name}`;
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
    this.#bonus = bonus;
    return super.render(...T);
  }

  /** @override */
  _onRender(...T) {
    super._onRender(...T);

    // Observe the filters in the picker tab.
    const filters = this.element.querySelectorAll(".tab[data-tab=filters] .filter[data-id]");
    const observer = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        const target = entry.target;
        const isIntersecting = entry.isIntersecting;
        const toc = observer.root.querySelector(`.toc [data-id="${target.dataset.id}"]`);
        toc.classList.toggle("viewed", isIntersecting);
      }
    }, {
      root: this.element.querySelector(".tab[data-tab=filters]"),
      rootMargin: "0px",
      threshold: 0.5
    });
    for (const filter of filters) observer.observe(filter);
  }

  /** @override */
  async _prepareContext(options) {
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
    const bonus = this.bonus;
    const source = bonus.toObject();
    const rollData = bonus.getRollData();

    const makeField = (path, options = {}) => {
      const field = bonus.schema.getField(path);
      const value = foundry.utils.getProperty(source, path);

      return {
        field: field,
        value: value,
        ...options
      };
    };

    // Root fields.
    const fields = context.fields = {};
    fields.enabled = makeField("enabled");
    fields.exclusive = makeField("exclusive");
    fields.optional = makeField("optional");
    fields.reminder = makeField("reminder", {
      disabled: !bonus.canRemind
    });
    fields.img = makeField("img");
    fields.description = makeField("description", {
      height: 200,
      enriched: await TextEditor.enrichHTML(bonus.description, {
        rollData: rollData, async: true, relativeTo: bonus.origin
      })
    });

    // Bonuses.
    const bonuses = context.bonuses = [];
    for (const k of Object.keys(source.bonuses)) {
      if (k === "modifiers") continue; // Handled separately.
      let options = {};
      if (k === "damageType") {
        options = {
          isDamage: true,
          blank: "DND5E.None",
          options: [],
          groups: ["DND5E.Damage", "DND5E.Healing"]
        };
        for (const [k, v] of Object.entries(CONFIG.DND5E.damageTypes)) {
          options.options.push({group: "DND5E.Damage", value: k, label: v.label});
        }
        for (const [k, v] of Object.entries(CONFIG.DND5E.healingTypes)) {
          options.options.push({group: "DND5E.Healing", value: k, label: v.label});
        }
      }
      const data = makeField(`bonuses.${k}`, options);
      bonuses.push(data);
    }

    // Modifiers.
    if (source.bonuses?.modifiers) {
      const initial = bonus.bonuses.modifiers.schema.initial();
      const paths = Object.keys(foundry.utils.flattenObject(initial));
      const modifiers = context.modifiers = {};
      for (const path of paths) {
        const parts = path.split(".");
        const key = parts.shift();
        modifiers[key] ??= {};
        modifiers[key][parts.pop()] = makeField(`bonuses.modifiers.${path}`);
      }

      const parts = ["3", "2d10", "1d4"];
      bonus.bonuses.modifiers.modifyParts(parts, rollData);
      modifiers.config ??= {};
      modifiers.config.example = parts.join(" + ");
      context.hasModifiers = true;
    } else context.hasModifiers = false;

    // Consumption.
    const consume = context.consume = {};
    if (!["save", "hitdie"].includes(bonus.type)) {
      consume.enabled = makeField("consume.enabled");
      consume.type = makeField("consume.type");
      consume.subtype = makeField("consume.subtype", {
        label: `BABONUS.Fields.Consume.Subtype.${source.consume.type.capitalize()}Label`
      });
      consume.formula = makeField("consume.formula", {
        placeholder: bonus.bonuses.bonus,
        show: bonus.consume.scales
      });
      consume.step = makeField("consume.value.step", {
        show: ["health", "currency"].includes(source.consume.type) && bonus.consume.scales
      });

      const isSlot = (source.consume.type === "slots") ? "Slot" : "";
      const scales = bonus.consume.scales;
      const v = bonus.consume.value;
      consume.value = {
        min: makeField("consume.value.min", {
          placeholder: game.i18n.localize(`BABONUS.Fields.Consume.Values.Min${isSlot}`)
        }),
        max: makeField("consume.value.max", {
          placeholder: game.i18n.localize(`BABONUS.Fields.Consume.Values.Max${isSlot}`)
        }),
        label: `BABONUS.Fields.Consume.Values.Label${isSlot}`,
        hint: `BABONUS.Fields.Consume.Values.Hint${scales ? "Scale" : ""}${isSlot}`,
        range: (scales && v.min && v.max) ? `(${v.min}&ndash;${v.max})` : null
      };

      consume.scales = makeField("consume.scales", {
        unavailable: !source.consume.type || ["effect", "inspiration"].includes(source.consume.type)
      });

      consume.subtype.show = true;
      if (source.consume.type === "currency") {
        consume.subtype.choices = Object.entries(CONFIG.DND5E.currencies).sort((a, b) => {
          return b[1].conversion - a[1].conversion;
        }).reduce((acc, [k, v]) => {
          acc[k] = v.label;
          return acc;
        }, {});
      } else if (source.consume.type === "hitdice") {
        consume.subtype.choices = CONFIG.DND5E.hitDieTypes.reduce((acc, d) => {
          acc[d] = d;
          return acc;
        }, {
          smallest: "DND5E.ConsumeHitDiceSmallest",
          largest: "DND5E.ConsumeHitDiceLargest"
        });
      } else consume.subtype.show = false;
    } else {
      consume.enabled = makeField("consume.enabled", {value: false, disabled: true});
    }

    // Aura.
    const aura = context.aura = {};
    aura.enabled = makeField("aura.enabled");
    if (aura.enabled.value) {
      aura.range = makeField("aura.range");
      let loc;
      let range;
      if (!bonus.aura.range || (bonus.aura.range > 0)) {
        loc = "BABONUS.Fields.Aura.Range.LabelFt";
        range = bonus.aura.range;
      } else if (bonus.aura.range === -1) {
        loc = "BABONUS.Fields.Aura.Range.LabelUnlimited";
        range = game.i18n.localize("DND5E.Unlimited");
      }
      if (loc) {
        aura.range.label = game.i18n.format(loc, {range: range});
      }

      aura.template = makeField("aura.template");
      aura.disposition = makeField("aura.disposition");
      aura.self = makeField("aura.self");
      aura.blockers = makeField("aura.blockers");
      aura.requirements = ["move", "light", "sight", "sound"].map(k => {
        return makeField(`aura.require.${k}`);
      });
    }

    context.labels = this._prepareLabels();
    context.filters = this.#prepareFilters();
    context.filterpickers = this.#prepareFilterPicker();
    context.tabs = tabs;
    context.bonus = bonus;
    // context.rootId = bonus.id; // Add this back once #11119 is fixed.

    return context;
  }

  /**
   * Prepare the filter picker.
   * @returns {object[]}
   */
  #prepareFilterPicker() {
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
  #prepareFilters() {
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
    if (this.bonus.consume.isValidConsumption && this.bonus.consume.enabled) {
      labels.push(game.i18n.localize("BABONUS.Labels.Consuming"));
    }
    if (this.bonus.aura.isToken) labels.push(game.i18n.localize("BABONUS.Labels.TokenAura"));
    if (this.bonus.aura.isTemplate) labels.push(game.i18n.localize("BABONUS.Labels.TemplateAura"));
    if (this.bonus.isReminder) labels.push(game.i18n.localize("BABONUS.Labels.Reminder"));

    return labels;
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
  static #onDeleteFilter(event, target) {
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
  static #onAddFilter(event, target) {
    const id = target.closest("[data-id]").dataset.id;
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
  static #onKeysDialog(event, target) {
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
  static #onCopyUuid(event, target) {
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
   * Scroll a filter into view in the picker.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static #onViewFilter(event, target) {
    const id = target.closest("[data-id]").dataset.id;
    const element = target.closest("[data-tab]").querySelector(`.filter[data-id="${id}"]`);
    element.scrollIntoView({behavior: "smooth"});
  }
}
