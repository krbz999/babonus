import {MODULE} from "../constants.mjs";

export class AppliedBonusesDialog extends Dialog {

  constructor(options) {
    super({}, options);
    this.bonuses = options.bonuses;
    this.dialog = options.dialog;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/appliedBonusesDialog.hbs`,
      classes: [MODULE, "overview"]
    });
  }

  get title() {
    return game.i18n.localize("BABONUS.OverviewTitle");
  }

  get id() {
    return `${this.dialog.id}-bonuses-overview`;
  }

  /** @override */
  async getData() {
    return {bonuses: this.bonuses};
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-uuid]").forEach(n => n.addEventListener("click", this._onClickUuid.bind(this)));
  }

  /**
   * When clicking a uuid tag, copy it.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onClickUuid(event) {
    await game.clipboard.copyPlainText(event.currentTarget.dataset.uuid);
    ui.notifications.info("BABONUS.OverviewCopied", {localize: true});
  }

  /** @override */
  _onClickButton(event) {
    this.close();
  }
}
