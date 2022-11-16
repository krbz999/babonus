import { arbitraryOperators, ATTACK_TYPES, ITEM_TYPES } from "../constants.mjs";

/**
 * Take a name of a filter and return an object with
 * - header: the filter's proper name
 * - description: a description of how the filter applies
 * - name: the name itself.
 * - requirements: what is required to make this option available (not shown for available effects).
 */
export function _constructFilterDataFromName(name) {
  return {
    name,
    header: `BABONUS.FILTER_PICKER.${name}.HEADER`,
    description: `BABONUS.TOOLTIPS.${name}`,
    requirements: `BABONUS.FILTER_PICKER.${name}.REQUIREMENTS`
  }
}

/**
 * Returns whether a filter is available to be added to babonus.
 */
export function _isFilterAvailable(name, { addedFilters, target, item, itemTypes }) {
  if (name === "arbitraryComparison") return true;
  if (addedFilters.has(name)) return false;

  if (["itemTypes", "damageTypes", "abilities"].includes(name)) return ["attack", "damage", "save"].includes(target);
  if (name === "attackTypes") return ["attack", "damage"].includes(target);
  if (name === "throwTypes") return target === "throw";
  if (name === "saveAbilities") return target === "save";
  if (["spellComponents", "spellLevels", "spellSchools"].includes(name)) return itemTypes.has("spell") && itemTypes.size === 1;
  if (["baseWeapons", "weaponProperties"].includes(name)) return itemTypes.has("weapon") && itemTypes.size === 1;
  if (name === "itemRequirements") return _canEquipOrAttuneToItem(item);
  if (["statusEffects", "targetEffects", "creatureTypes", "remainingSpellSlots", "macroConditions"].includes(name)) return true;

  return false;
}

function _canEquipOrAttuneToItem(item) {
  if (!(item instanceof Item)) return false;
  return _canEquipItem(item) || _canAttuneToItem(item);
}

export function _canEquipItem(item) {
  if (!(item instanceof Item)) return false;
  return foundry.utils.hasProperty(item, "system.equipped");
}

export function _canAttuneToItem(item) {
  if (!(item instanceof Item)) return false;
  const { REQUIRED, ATTUNED } = CONFIG.DND5E.attunementTypes;
  return [REQUIRED, ATTUNED].includes(item.system.attunement);
}

export function _addToAddedFilters(app, name) {
  const added = app._addedFilters ?? new Set();
  added.add(name);
  app._addedFilters = added;
}

// create and append the form-group for a specific filter.
export async function _employFilter(app, name) {
  // what template and what data to use depends on the name of the filter.
  let template = "modules/babonus/templates/builder_components/";
  const item = app.object instanceof Item ? app.object : null;
  const data = {
    tooltip: `BABONUS.TOOLTIPS.${name}`,
    label: `BABONUS.LABELS.${name}`,
    name
  };

  if (name === "spellComponents") {
    template += "checkboxes_select.hbs";
    data.array =
      Object.entries(CONFIG.DND5E.spellComponents)
        .concat(Object.entries(CONFIG.DND5E.spellTags))
        .map(([key, { abbr, label }]) => {
          return { value: key, label: abbr, tooltip: label };
        });
    data.selectOptions = [
      { value: "ANY", label: "BABONUS.VALUES.MATCH_ANY" },
      { value: "ALL", label: "BABONUS.VALUES.MATCH_ALL" }
    ];
  } else if (["spellLevels", "itemTypes", "attackTypes"].includes(name)) {
    template += "checkboxes.hbs";
    if (name === "spellLevels") {
      data.array = Object.entries(CONFIG.DND5E.spellLevels).map(([value, tooltip]) => {
        return { value, label: value, tooltip };
      });
    } else if (name === "itemTypes") {
      data.array = ITEM_TYPES.map(i => {
        return { value: i, label: i.slice(0,4).toUpperCase(), tooltip: `DND5E.ItemType${i.titleCase()}` };
      });
    } else if (name === "attackTypes") {
      data.array = ATTACK_TYPES.map(a => {
        return { value: a, label: a, tooltip: CONFIG.DND5E.itemActionTypes[a] };
      });
    }
  } else if ("itemRequirements" === name) {
    template += "label_checkbox_label_checkbox.hbs";
    data.canEquip = _canEquipItem(item);
    data.canAttune = _canAttuneToItem(item);
  } else if (["damageTypes", "abilities", "saveAbilities", "throwTypes", "statusEffects", "targetEffects", "spellSchools", "baseWeapons"].includes(name)) {
    template += "text_keys.hbs";
  } else if ("arbitraryComparison" === name) {
    // handle this case specially.
    await _employRepeatableFilter(app, name);
    return true;
  } else if (["weaponProperties", "creatureTypes"].includes(name)) {
    template += "text_text_keys.hbs";
  } else if ("macroConditions" === name) {
    template += "textarea.hbs";
  } else if(["remainingSpellSlots"].includes(name)){
    template += "text_dash_text.hbs";
  }

  const DIV = document.createElement("DIV");
  DIV.innerHTML = await renderTemplate(template, data);
  app.element[0].querySelector("div.filters").appendChild(...DIV.children);
  return true;
}

async function _employRepeatableFilter(app, name) {
  // what template and what data to use depends on the name of the filter.
  let template = "modules/babonus/templates/builder_components/";
  const data = {
    tooltip: `BABONUS.TOOLTIPS.${name}`,
    label: `BABONUS.LABELS.${name}`,
    name,
  };

  const DIV = document.createElement("DIV");
  DIV.innerHTML = "";

  if (name === "arbitraryComparison") {
    template += "text_select_text.hbs";
    data.selectOptions = arbitraryOperators;
    data.placeholderOne = `BABONUS.PLACEHOLDERS.${name}.one`;
    data.placeholderOther = `BABONUS.PLACEHOLDERS.${name}.other`;
  }
  const len = foundry.utils.getProperty(app._babObject, `filters.${name}`)?.length;

  // we are creating the initials when editing an existing bonus.
  if (len) {
    for (let i = 0; i < len; i++) {
      data.iterName = `${name}.${i}`;
      DIV.innerHTML += await renderTemplate(template, data);
    }
    app.element[0].querySelector("div.filters").append(...DIV.children);
    delete app._babObject.filters[name];
  }

  // add one new row when building.
  else {
    const iteration = [...app.element[0].querySelectorAll(`.left-side .filters [data-name="${name}"]`)].length;
    data.iterName = `${name}.${iteration}`;
    DIV.innerHTML = await renderTemplate(template, data);
    app.element[0].querySelector("div.filters").appendChild(...DIV.children);
  }

  return true;
}
