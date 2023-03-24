import {AURA_TARGETS, MODULE} from "../constants.mjs";

export class AuraConfigurationDialog extends FormApplication {

  constructor(object, options = {}) {
    super(object, options);
    this.clone = options.bab.clone();
    this.builder = options.builder;
  }

  get id() {
    return `${MODULE}AuraConfigurationDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/auraConfigurationApp.hbs`,
      classes: [MODULE, "aura-config"]
    });
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationAuraTitle", {name: this.options.bab.name});
  }

  /** @override */
  async getData() {
    const choices = Object.entries(AURA_TARGETS).reduce((acc, [k, v]) => {
      acc[v] = `BABONUS.ConfigurationAuraDisposition.${k}`;
      return acc;
    }, {});
    return {
      disableRange: this.clone.isTemplateAura || (this.clone.aura.isTemplate && (this.clone.parent instanceof Item)),
      disableTemplate: !(this.clone.parent instanceof Item),
      blockers: this.clone.aura.blockers.join(";"),
      choices,
      ...this.clone
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelector("[data-action='keys-dialog']").addEventListener("click", this.builder._onDisplayKeysDialog.bind(this));
  }

  /** @override */
  async _updateObject(event, formData) {
    const data = foundry.utils.mergeObject({
      aura: {
        enabled: true,
        isTemplate: false,
        range: null,
        self: null,
        disposition: null,
        blockers: null
      },
    }, formData);
    return this.object.setFlag(MODULE, `bonuses.${this.options.bab.id}`, data);
  }

  /** @override */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    let {name, value, type, checked} = event.currentTarget;
    if ((name === "aura.range") && (value === "")) value = null;
    const update = {
      [name]: type === "checkbox" ? checked : value,
      "aura.blockers": this.form["aura.blockers"].value
    };
    if (!(this.clone.parent instanceof Item)) update["aura.isTemplate"] = false;
    this.clone.updateSource(update);
    await this._render();
    this.element[0].querySelector(`[name='${name}']`).focus();
  }
}
