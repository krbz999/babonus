import { FILTER_NAMES, MODULE } from "../constants.mjs";
import {
  _addToAddedFilters,
  _constructFilterDataFromName,
  _employFilter,
  _isFilterAvailable
} from "../helpers/filterPickerHelpers.mjs";

export class BabonusFilterPicker {
  constructor(object, options) {
    this.object = object;
  }

  /*static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      closeOnSubmit: false,
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/build_a_bonus.html`,//,
      classes: [MODULE],
      scrollY: [".available-filters", ".unavailable-filters"]
    });
  }*/

  get id() {
    return `${MODULE}-filterPicker-${this.object.id}`;
  }

  async getData() {
    const data = {};

    const addedFilters = this.object._addedFilters ?? [];
    const availableFilters = [];
    const unavailableFilters = [];

    for (const name of FILTER_NAMES) {
      if (addedFilters.includes(name) && name!=="arbitraryComparison") continue;
      const filterData = _constructFilterDataFromName(name);
      const item = this.object.object;
      const target = this.object._target;
      const itemTypes = this.object._itemTypes ?? [];
      if (_isFilterAvailable(name, { addedFilters, target, item, itemTypes })) {
        availableFilters.push(filterData);
      } else unavailableFilters.push(filterData);
    }

    data.availableFilters = availableFilters;
    data.unavailableFilters = unavailableFilters;

    return data;
  }

  async getHTML() {
    const template = `modules/${MODULE}/templates/subapplications/filterPicker.hbs`;
    const data = await this.getData();
    return renderTemplate(template, data);
  }

  activateListeners(html) {
    //super.activateListeners(html);
    html[0].addEventListener("click", async (e) => {
      const a = e.target.closest(".filter-add");
      if (!a) return;

      const name = a.dataset.filter;

      // add this filter to the UI.
      await _employFilter(this.object, name);
      // add the filter to babonus _addedFilters.
      _addToAddedFilters(this.object, name);
      // remove this filter.
      html[0].querySelector(".right-side div.filter-picker").innerHTML = await this.getHTML();
    });
  }
}
