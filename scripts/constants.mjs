export const MODULE = {
  ID: "babonus",
  NAME: "Build-a-Bonus",
  ICON: "fa-solid fa-otter",
  CONSUMPTION_TYPES: new Set([
    "uses",
    "quantity",
    "slots",
    "effect",
    "health",
    "currency",
    "inspiration",
    "hitdice"
  ])
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
