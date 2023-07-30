import {MODULE} from "../constants.mjs";
import {module} from "../data/_module.mjs";

export class AuraConfigurationDialog extends FormApplication {
  constructor(object, options = {}) {
    super(object, options);
    this.clone = options.bab.clone();
    this.builder = options.builder;
  }

  get id() {
    return `${MODULE.ID}AuraConfigurationDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE.ID}/templates/subapplications/auraConfigurationApp.hbs`,
      classes: [MODULE.ID, "aura-config"]
    });
  }

  get document() {
    return this.object;
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationAuraTitle", {name: this.options.bab.name});
  }

  /** @override */
  async getData() {
    const choices = Object.entries(module.fields.aura.OPTIONS).reduce((acc, [k, v]) => {
      acc[v] = `BABONUS.ConfigurationAuraDisposition${k.titleCase()}`;
      return acc;
    }, {});

    const aura = this.clone.aura;
    return {
      disableRange: aura.isTemplate || (aura.template && (this.clone.parent instanceof Item)),
      disableTemplate: !(this.clone.parent instanceof Item),
      blockers: aura.blockers.join(";"),
      choices,
      source: this.clone.toObject(),
      clone: this.clone,
      displayedRange: aura.range > 0 ? aura.range : aura.range === -1 ? game.i18n.localize("DND5E.Unlimited") : 0
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    const button = html[0].querySelector("[data-action='keys-dialog']");
    button.addEventListener("click", this.builder._onDisplayKeysDialog.bind(this));
    html[0].querySelector("[name='aura.range']").addEventListener("focus", e => e.currentTarget.select());
  }

  /** @override */
  async _updateObject(event, formData) {
    const defaults = this.clone.getDefaults("aura");
    const data = foundry.utils.mergeObject({aura: defaults}, formData);
    return this.document.setFlag(MODULE.ID, `bonuses.${this.options.bab.id}`, data);
  }

  /** @override */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    let {name, value, type, checked} = event.currentTarget;
    if ((name === "aura.range") && (value === "")) value = null;
    const update = {
      [name]: (type === "checkbox") ? checked : value,
      "aura.blockers": this.form["aura.blockers"].value
    };
    if (!(this.clone.parent instanceof Item)) update["aura.template"] = false;
    this.clone.updateSource(update);
    await this._render();
    this.element[0].querySelector(`[name='${name}']`).focus();
  }
}
