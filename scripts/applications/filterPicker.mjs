import { AURA_TARGETS, BONUS_TYPES_FORMDATA, FILTER_NAMES, MODULE, TYPES } from "../constants.mjs";
import {
  _constructFilterDataFromName,
  _employFilter,
  _isFilterAvailable
} from "../helpers/filterPickerHelpers.mjs";
import { _getBonuses } from "../helpers/helpers.mjs";

export class BabonusFilterPicker {
  constructor(object) {
    this.object = object;
  }

  get id() {
    return `${MODULE}-filterPicker-${this.object.id}`;
  }

  render() {
    this.object._updateCurrentBonuses();
  }

  async getData() {
    const addedFilters = this.object._addedFilters ?? new Set();
    const availableFilters = [];
    const unavailableFilters = [];

    for (const name of FILTER_NAMES) {
      if (addedFilters.has(name) && name !== "arbitraryComparison") continue;
      const filterData = _constructFilterDataFromName(name);
      const item = this.object.object;
      const type = this.object._type;
      const itemTypes = this.object._itemTypes ?? new Set();
      if (_isFilterAvailable(name, { addedFilters, type, item, itemTypes })) {
        availableFilters.push(filterData);
      } else unavailableFilters.push(filterData);
    }

    // sort by label.
    availableFilters.sort((a, b) => {
      const A = game.i18n.localize(a.header);
      const B = game.i18n.localize(b.header);
      return A.localeCompare(B);
    });
    unavailableFilters.sort((a, b) => {
      const A = game.i18n.localize(a.header);
      const B = game.i18n.localize(b.header);
      return A.localeCompare(B);
    });

    return { availableFilters, unavailableFilters };
  }

  async getHTMLFilters() {
    const template = "modules/babonus/templates/subapplications/filterPicker.hbs";
    const data = await this.getData();
    return renderTemplate(template, data);
  }

  async getHTMLRequired(edit = false) {
    const template = "modules/babonus/templates/builder_components/_required_fields.hbs";
    const type = TYPES.find(t => t.value === this.object._type);
    const data = {
      type,
      bonusTypes: BONUS_TYPES_FORMDATA[this.object._type],
      id: this.object._id,
      localeString: edit ? "BABONUS.EditingBonus" : "BABONUS.CreatingBonus"
    };
    return renderTemplate(template, data);
  }

  async getHTMLBonuses() {
    const template = "modules/babonus/templates/builder_components/_bonuses.hbs";
    const type = this.object._type;
    const data = { bonuses: BONUS_TYPES_FORMDATA[type] };
    return renderTemplate(template, data);
  }

  async getHTMLCurrentBonuses() {
    const template = "modules/babonus/templates/builder_components/_current_bonuses.hbs";
    const data = { bonuses: _getBonuses(this.object.object) };
    return renderTemplate(template, data);
  }

  activateListeners(html) {
    html[0].addEventListener("click", async (e) => {
      const a = e.target.closest("a.filter-add, .filter-header a");
      if (!a) return;

      const name = a.closest("div.filter").dataset.id;
      await _employFilter(this.object, name);

      // Add to added filters.
      const added = this.object._addedFilters ?? new Set();
      added.add(name);
      this.object._addedFilters = added;

      this.object._saveScrollPositions(this.object.element);
      html[0].querySelector(".right-side div.filter-picker").innerHTML = await this.getHTMLFilters();
      this.object._restoreScrollPositions(this.object.element);
    });
  }
}
