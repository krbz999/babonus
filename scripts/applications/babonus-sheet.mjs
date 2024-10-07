import {Babonus} from "../models/babonus-model.mjs";
import {MODULE} from "../constants.mjs";

export default class BabonusSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.DocumentSheetV2
) {
  /**
   * @param {object} options            Optional configuration parameters for how the sheet behaves.
   * @param {Babonus} options.bonus     The babonus managed by this sheet.
   */
  constructor({bonus, ...options}) {
    super({...options, document: bonus.parent, bonusId: bonus.id});

    const ids = new Set(Object.keys(bonus.toObject().filters)).filter(id => {
      return babonus.abstract.DataFields.fields[id].storage(bonus);
    });

    /**
     * The filters that are currently active.
     * @type {Set<string>}
     */
    this._filters = ids;
  }

  /* -------------------------------------------------- */

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
      addFilter: this.#onAddFilter,
      copyUuid: {handler: this.#onCopyUuid, buttons: [0, 2]},
      deleteFilter: this.#onDeleteFilter,
      keysDialog: this.#onKeysDialog,
      viewFilter: this.#onViewFilter
    },
    bonusId: null
  };

  /* -------------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: "modules/babonus/templates/sheet-header.hbs"
    },
    navigation: {
      template: "modules/babonus/templates/sheet-navigation.hbs"
    },
    description: {
      template: "modules/babonus/templates/sheet-description.hbs",
      scrollable: [""]
    },
    bonuses: {
      template: "modules/babonus/templates/sheet-bonuses.hbs",
      scrollable: [""]
    },
    configuration: {
      template: "modules/babonus/templates/sheet-configuration.hbs",
      scrollable: [""]
    },
    filters: {
      template: "modules/babonus/templates/sheet-filters.hbs",
      scrollable: [".toc", ".picker"]
    },
    advanced: {
      template: "modules/babonus/templates/sheet-advanced.hbs",
      scrollable: [""]
    }
  };

  /* -------------------------------------------------- */

  /** @override */
  tabGroups = {
    main: "description"
  };

  /* -------------------------------------------------- */

  /**
   * The babonus represented by this sheet.
   * @type {Babonus}
   */
  get bonus() {
    return babonus.getCollection(this.document).get(this.options.bonusId);
  }

  /* -------------------------------------------------- */

  /** @override */
  get title() {
    return `${game.i18n.localize("BABONUS.ModuleTitle")}: ${this.bonus.name}`;
  }

  /* -------------------------------------------------- */

  /** @override */
  get isEditable() {
    return super.isEditable && !!this.document.isOwner;
  }

  /* -------------------------------------------------- */

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.uniqueId += `.Babonus.${options.bonusId}`;
    return options;
  }

  /* -------------------------------------------------- */

  /** @override */
  _prepareSubmitData(event, form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);

    // Move bonuses.modifiers.config.enabled into respective objects.
    let enabled = submitData.bonuses?.modifiers?.config?.enabled;
    if (enabled) {
      enabled = new Set(enabled);
      for (const k of ["amount", "explode", "maximum", "minimum", "reroll", "size"]) {
        foundry.utils.setProperty(submitData, `bonuses.modifiers.${k}.enabled`, enabled.has(k));
      }
    }

    const bonus = this.bonus;

    bonus.validate({changes: submitData, clean: true, fallback: false});
    submitData.id = bonus.id;
    const collection = babonus.getCollection(this.document).contents.map(k => k.toObject());
    bonus.updateSource(submitData);
    collection.findSplice(k => k.id === bonus.id, bonus.toObject());
    return {flags: {babonus: {bonuses: collection}}};
  }

  /* -------------------------------------------------- */

  /** @override */
  render(...T) {
    if (!this.bonus) return this.close();
    return super.render(...T);
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

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
        rollData: rollData, relativeTo: bonus.origin
      })
    });

    // Bonuses.
    const bonuses = context.bonuses = [];
    for (const k of Object.keys(source.bonuses)) {
      if (k === "modifiers") continue; // Handled separately.
      let options = {};
      if (k === "damageType") {
        const dgroup = game.i18n.localize("DND5E.Damage");
        const hgroup = game.i18n.localize("DND5E.Healing");
        options = {
          isDamage: true,
          options: []
        };
        for (const [k, v] of Object.entries(CONFIG.DND5E.damageTypes)) {
          options.options.push({group: dgroup, value: k, label: v.label});
        }
        for (const [k, v] of Object.entries(CONFIG.DND5E.healingTypes)) {
          options.options.push({group: hgroup, value: k, label: v.label});
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
      modifiers.enabled = {value: new Set(), choices: []};
      for (const path of paths) {
        const parts = path.split(".");
        const key = parts.shift();
        const tail = parts.pop();
        modifiers[key] ??= {};
        if (tail !== "enabled") {
          modifiers[key][tail] = makeField(`bonuses.modifiers.${path}`);
        } else {
          if (source.bonuses.modifiers[key].enabled) {
            modifiers[key].enabled = true;
            modifiers.enabled.value.add(key);
          }
          modifiers.enabled.choices.push({
            value: key,
            label: bonus.bonuses.modifiers.schema.getField(`${key}.enabled`).label
          });
        }
      }
      modifiers.enabled.field = new foundry.data.fields.SetField(new foundry.data.fields.StringField(), {
        label: game.i18n.localize("BABONUS.MODIFIERS.FIELDS.config.enabled.label"),
        hint: game.i18n.localize("BABONUS.MODIFIERS.FIELDS.config.enabled.hint")
      });

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
      consume.subtype = makeField("consume.subtype");
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
          placeholder: game.i18n.localize(`BABONUS.FIELDS.consume.value.min.label${isSlot}`)
        }),
        max: makeField("consume.value.max", {
          placeholder: game.i18n.localize(`BABONUS.FIELDS.consume.value.max.label${isSlot}`)
        }),
        label: game.i18n.localize(`BABONUS.FIELDS.consume.value.label${isSlot}`),
        hint: game.i18n.localize(`BABONUS.FIELDS.consume.value.hint${scales ? "Scale" : ""}${isSlot}`),
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
          smallest: game.i18n.localize("DND5E.ConsumeHitDiceSmallest"),
          largest: game.i18n.localize("DND5E.ConsumeHitDiceLargest")
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
        loc = "BABONUS.FIELDS.aura.range.labelFt";
        range = bonus.aura.range;
      } else if (bonus.aura.range === -1) {
        loc = "BABONUS.FIELDS.aura.range.labelUnlimited";
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

  /* -------------------------------------------------- */

  /**
   * Prepare the filter picker.
   * @returns {object[]}
   */
  #prepareFilterPicker() {
    const bonus = this.bonus;
    const keys = Object.keys(bonus.filters);
    return keys.reduce((acc, key) => {
      if (!this._filters.has(key) || babonus.abstract.DataFields.fields[key].repeatable) acc.push({
        id: key,
        repeats: babonus.abstract.DataFields.fields[key].repeatable ? bonus.filters[key].length : null,
        field: bonus.schema.getField(`filters.${key}`)
      });
      return acc;
    }, []).sort((a, b) => {
      a = bonus.schema.getField(`filters.${a.id}`).label;
      b = bonus.schema.getField(`filters.${b.id}`).label;
      return a.localeCompare(b);
    });
  }

  /* -------------------------------------------------- */

  /**
   * Prepare filters.
   * @returns {string[]}
   */
  #prepareFilters() {
    const htmls = [];
    const bonus = this.bonus;
    const keys = [...this._filters].sort((a, b) => {
      a = bonus.schema.getField(`filters.${a}`).label;
      b = bonus.schema.getField(`filters.${b}`).label;
      return a.localeCompare(b);
    });
    for (const key of keys) {
      const filter = babonus.abstract.DataFields.fields[key];
      htmls.push(filter.render(bonus));
    }
    return htmls;
  }

  /* -------------------------------------------------- */

  /**
   * Prepare labels.
   * @returns {string[]}
   */
  _prepareLabels() {
    const labels = [];
    const bonus = this.bonus;

    labels.push(game.i18n.localize(`BABONUS.${bonus.type.toUpperCase()}.Label`));

    const filterLabels = Object.keys(bonus.filters).filter(key => {
      return babonus.abstract.DataFields.fields[key].storage(bonus);
    }).length;
    labels.push(game.i18n.format("BABONUS.Labels.Filters", {n: filterLabels}));

    if (!bonus.enabled) labels.push(game.i18n.localize("BABONUS.Labels.Disabled"));
    if (bonus.isExclusive) labels.push(game.i18n.localize("BABONUS.Labels.Exclusive"));
    if (bonus.isOptional) labels.push(game.i18n.localize("BABONUS.Labels.Optional"));
    if (bonus.consume.isValidConsumption && bonus.consume.enabled) {
      labels.push(game.i18n.localize("BABONUS.Labels.Consuming"));
    }
    if (bonus.aura.isToken) labels.push(game.i18n.localize("BABONUS.Labels.TokenAura"));
    if (bonus.aura.isTemplate) labels.push(game.i18n.localize("BABONUS.Labels.TemplateAura"));
    if (bonus.isReminder) labels.push(game.i18n.localize("BABONUS.Labels.Reminder"));

    return labels;
  }

  /* -------------------------------------------------- */

  /**
   * Handle deleting a filter.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static #onDeleteFilter(event, target) {
    const bonus = this.bonus;
    const id = target.dataset.id;
    const data = bonus.toObject();

    if (babonus.abstract.DataFields.fields[id].repeatable) {
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
    collection.findSplice(k => k.id === bonus.id, data);
    this.document.update({"flags.babonus.bonuses": collection});
  }

  /* -------------------------------------------------- */

  /**
   * Handle adding a filter.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static #onAddFilter(event, target) {
    const bonus = this.bonus;
    const id = target.closest("[data-id]").dataset.id;
    this._filters.add(id);
    if (babonus.abstract.DataFields.fields[id].repeatable) {
      const data = bonus.toObject();
      data.filters[id].push({});
      const collection = babonus.getCollection(this.document).contents.map(k => k.toObject());
      collection.findSplice(k => k.id === bonus.id, data);
      this.document.update({"flags.babonus.bonuses": collection});
    } else {
      this.render();
    }
  }

  /* -------------------------------------------------- */

  /**
   * Helper function to display the keys dialog and update the corresponding filter value.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static #onKeysDialog(event, target) {
    const bonus = this.bonus;
    const filterId = target.dataset.id;
    const filter = babonus.abstract.DataFields.fields[filterId];
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
      targetArmors: CONFIG.DND5E.armorTypes,
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

  /* -------------------------------------------------- */

  /**
   * Copy the uuid or id of the bonus.
   * @param {Event} event             The initiating click event.
   * @param {HTMLElement} target      Targeted html element.
   */
  static #onCopyUuid(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    const bonus = this.bonus;
    const id = (event.button === 2) ? bonus.id : bonus.uuid;
    const type = (event.button === 2) ? "id" : "uuid";
    const label = game.i18n.localize(bonus.constructor.metadata.label);
    game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {label, type, id}));
  }

  /* -------------------------------------------------- */

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
