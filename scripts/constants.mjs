export const MODULE = {
  ID: "babonus",
  NAME: "Build-a-Bonus",
  ICON: "fa-solid fa-otter",
  CONSUMPTION_TYPES: {
    currency: "DND5E.Currency",
    effect: "BABONUS.FIELDS.consume.type.optionEffect",
    health: "DND5E.HitPoints",
    hitdice: "DND5E.HitDice",
    inspiration: "DND5E.Inspiration",
    quantity: "DND5E.Quantity",
    slots: "BABONUS.FIELDS.consume.type.optionSlots",
    uses: "DND5E.LimitedUses"
  },
  DISPOSITION_TYPES: {
    2: "BABONUS.FIELDS.aura.disposition.optionAny",
    1: "BABONUS.FIELDS.aura.disposition.optionAlly",
    "-1": "BABONUS.FIELDS.aura.disposition.optionEnemy"
  },
  HEALTH_PERCENTAGES_CHOICES: {
    0: "BABONUS.FIELDS.filters.healthPercentages.type.optionLT",
    1: "BABONUS.FIELDS.filters.healthPercentages.type.optionGT"
  },
  ATTACK_MODES_CHOICES: {
    offhand: "DND5E.ATTACK.Mode.Offhand",
    oneHanded: "DND5E.ATTACK.Mode.OneHanded",
    thrown: "DND5E.ATTACK.Mode.Thrown",
    "thrown-offhand": "DND5E.ATTACK.Mode.ThrownOffhand",
    twoHanded: "DND5E.ATTACK.Mode.TwoHanded"
  },
  SPELL_COMPONENT_CHOICES: {
    ANY: "BABONUS.FIELDS.filters.spellComponents.match.optionAny",
    ALL: "BABONUS.FIELDS.filters.spellComponents.match.optionAll"
  },
  TOKEN_SIZES_CHOICES: {
    0: "BABONUS.FIELDS.filters.tokenSizes.type.optionGT",
    1: "BABONUS.FIELDS.filters.tokenSizes.type.optionLT"
  },
  MODIFIER_MODES: {
    0: "BABONUS.MODIFIERS.FIELDS.mode.optionAdd",
    1: "BABONUS.MODIFIERS.FIELDS.mode.optionMultiply"
  }
};

/* -------------------------------------------------- */

export const SETTINGS = {
  AURA: "showAuraRanges",
  LABEL: "headerLabel",
  PLAYERS: "allowPlayers",
  SCRIPT: "disableCustomScriptFilter",
  FUMBLE: "allowFumbleNegation",
  SHEET_TAB: "showSheetTab",
  RADIUS: "padAuraRadius"
};
