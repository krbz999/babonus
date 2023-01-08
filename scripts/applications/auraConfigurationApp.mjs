import { AURA_TARGETS, MODULE } from "../constants.mjs";
import { _createBabonus } from "../helpers/helpers.mjs";

export class AuraConfigurationDialog extends FormApplication {
  get id() {
    return `${MODULE}AuraConfigurationDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/auraConfigurationApp.hbs`
    });
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationAuraTitle", { name: this.options.bab.name });
  }

  async getData() {
    const aura = this.options.bab.aura;

    const templateDisabled = !(this.options.bab.parent instanceof Item);
    const templateChecked = !templateDisabled && aura.isTemplate;
    const blockers = aura.blockers.join(";");
    const choices = Object.entries(AURA_TARGETS).reduce((acc, [k, v]) => {
      acc[v] = `BABONUS.VALUES.DISPOSITION.${k}`;
      return acc;
    }, {});

    return { aura, templateDisabled, templateChecked, blockers, choices };
  }

  async _updateObject(event, formData) {
    try {
      formData["aura.enabled"] = true;
      const data = foundry.utils.mergeObject(this.options.bab.toString(), formData);
      _createBabonus(data); // attempt.
      return this.object.setFlag(MODULE, `bonuses.${this.options.bab.id}`, formData);
    } catch (err) {
      console.error(err);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelector("button.babonus-keys").addEventListener("click", async (event) => {
      return this.options.builder._displayKeysDialog(event.currentTarget);
    });
  }

  _onChangeInput(event) {
    if (event.target.name === "aura.range") {
      event.target.value = Math.clamped(Math.round(event.target.value), -1, 500);
    } else if (event.target.name === "aura.isTemplate") {
      const checked = event.target.checked;
      this.form["aura.range"].disabled = checked;
      this.form["aura.blockers"].disabled = checked;
      this.form.querySelector("button.babonus-keys").disabled = checked;
    }
  }
}
