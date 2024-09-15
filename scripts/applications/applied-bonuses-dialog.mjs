import {MODULE} from "../constants.mjs";
import registry from "../registry.mjs";

export default class AppliedBonusesDialog extends Dialog {
  constructor(options) {
    super({}, options);
    this.dialog = options.dialog;
  }

  /* -------------------------------------------------- */

  /** @override */
  get title() {
    return game.i18n.localize("BABONUS.OverviewTitle");
  }

  /* -------------------------------------------------- */

  /** @override */
  get id() {
    return `${this.dialog.id}-bonuses-overview`;
  }

  /* -------------------------------------------------- */

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE.ID}/templates/subapplications/applied-bonuses-dialog.hbs`,
      classes: [MODULE.ID, "overview"]
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  async getData() {
    return {bonuses: registry.get(this.options.id).bonuses};
  }

  /* -------------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-uuid]").forEach(n => n.addEventListener("click", this._onClickUuid.bind(this)));
  }

  /* -------------------------------------------------- */

  /**
   * When clicking a uuid tag, copy it.
   * @param {Event} event     The initiating click event.
   */
  async _onClickUuid(event) {
    await game.clipboard.copyPlainText(event.currentTarget.dataset.uuid);
    ui.notifications.info("BABONUS.OverviewCopied", {localize: true});
  }

  /* -------------------------------------------------- */

  /** @override */
  _onClickButton(event) {
    this.close();
  }
}
