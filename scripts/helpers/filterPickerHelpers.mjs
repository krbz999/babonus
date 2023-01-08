import { ARBITRARY_OPERATORS, ATTACK_TYPES, ITEM_ROLL_TYPES } from "../constants.mjs";

/**
 * Take a name of a filter and return an object with
 * - header: the filter's proper name
 * - description: a description of how the filter applies
 * - name: the name itself.
 * - requirements: what is required to make this option available (not shown for available effects).
 */
export function _constructFilterDataFromName(name) {
  const localeName = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    name,
    header: `BABONUS.Filters${localeName}`,
    description: `BABONUS.Filters${localeName}Tooltip`,
    requirements: `BABONUS.Filters${localeName}Requirements`
  }
}

/**
 * Returns whether a filter is available to be added to babonus.
 */
export function _isFilterAvailable(name, { addedFilters, type, item, itemTypes }) {
  if (name === "arbitraryComparison") return true;
  if (addedFilters.has(name)) return false;

  if (["itemTypes", "damageTypes", "abilities"].includes(name)) return ["attack", "damage", "save"].includes(type);
  if (name === "attackTypes") return ["attack", "damage"].includes(type);
  if (name === "throwTypes") return type === "throw";
  if (name === "saveAbilities") return type === "save";
  if (["spellComponents", "spellLevels", "spellSchools"].includes(name)) return itemTypes.has("spell") && itemTypes.size === 1;
  if (["baseWeapons", "weaponProperties"].includes(name)) return itemTypes.has("weapon") && itemTypes.size === 1;
  if (name === "itemRequirements") return _canEquipOrAttuneToItem(item);
  if (["statusEffects", "targetEffects", "creatureTypes", "remainingSpellSlots", "customScripts"].includes(name)) return true;

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

// create and append the form-group for a specific filter.
export async function _employFilter(app, name) {
  // what template and what data to use depends on the name of the filter.
  let template = "modules/babonus/templates/builder_components/";
  const localeName = name.charAt(0).toUpperCase() + name.slice(1);
  const item = app.object instanceof Item ? app.object : null;
  const data = {
    tooltip: `BABONUS.Filters${localeName}Tooltip`,
    label: `BABONUS.Filters${localeName}Label`,
    name,
    appId: app.object.id
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
      { value: "ANY", label: "BABONUS.FiltersSpellComponentsMatchAny" },
      { value: "ALL", label: "BABONUS.FiltersSpellComponentsMatchAll" }
    ];
  } else if (["spellLevels", "itemTypes", "attackTypes"].includes(name)) {
    template += "checkboxes.hbs";
    if (name === "spellLevels") {
      data.array = Object.entries(CONFIG.DND5E.spellLevels).map(([value, tooltip]) => {
        return { value, label: value, tooltip };
      });
    } else if (name === "itemTypes") {
      data.array = ITEM_ROLL_TYPES.map(i => {
        return { value: i, label: i.slice(0, 4).toUpperCase(), tooltip: `DND5E.ItemType${i.titleCase()}` };
      });
    } else if (name === "attackTypes") {
      data.array = ATTACK_TYPES.map(a => {
        return { value: a, label: a.toUpperCase(), tooltip: CONFIG.DND5E.itemActionTypes[a] };
      });
    }
  } else if ("itemRequirements" === name) {
    template += "label_checkbox_label_checkbox.hbs";
    data.canEquip = _canEquipItem(item);
    data.canAttune = _canAttuneToItem(item);
  } else if (["damageTypes", "abilities", "saveAbilities", "throwTypes", "spellSchools", "baseWeapons"].includes(name)) {
    template += "text_keys.hbs";
    data.getter = name;
    data.getterName = "Filters" + name.charAt(0).toUpperCase() + name.slice(1);
  } else if (["statusEffects", "targetEffects"].includes(name)) {
    template += "text_keys.hbs";
    data.getter = "effects";
    data.getterName = "Filters" + name.charAt(0).toUpperCase() + name.slice(1);
  } else if ("arbitraryComparison" === name) {
    // handle this case specially.
    await _employRepeatableFilter(app, name);
    return true;
  } else if (["weaponProperties", "creatureTypes"].includes(name)) {
    template += "text_text_keys.hbs";
    data.getter = name;
    data.getterName = "Filters" + name.charAt(0).toUpperCase() + name.slice(1);
  } else if ("customScripts" === name) {
    template += "textarea.hbs";
  } else if (["remainingSpellSlots"].includes(name)) {
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
  const localeName = name.charAt(0).toUpperCase() + name.slice(1);
  const data = {
    tooltip: `BABONUS.Filters${localeName}Tooltip`,
    label: `BABONUS.Filters${localeName}Label`,
    name,
  };

  const DIV = document.createElement("DIV");
  DIV.innerHTML = "";

  if (name === "arbitraryComparison") {
    template += "text_select_text.hbs";
    data.selectOptions = ARBITRARY_OPERATORS;
    data.placeholderOne = `BABONUS.Filters${localeName}One`;
    data.placeholderOther = `BABONUS.Filters${localeName}Other`;
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
    const iteration = [...app.element[0].querySelectorAll(`.left-side .filters [data-id="${name}"]`)].length;
    data.iterName = `${name}.${iteration}`;
    DIV.innerHTML = await renderTemplate(template, data);
    app.element[0].querySelector("div.filters").appendChild(...DIV.children);
  }

  return true;
}
