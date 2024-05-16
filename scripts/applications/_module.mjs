import {AppliedBonusesDialog} from "./applied-bonuses-dialog.mjs";
import {BabonusSheet} from "./babonus-sheet.mjs";
import {BabonusWorkshop} from "./babonus-workshop.mjs";
import {BonusCollector} from "./bonus-collector.mjs";
import {CharacterSheetTab} from "./character-sheet-tab.mjs";
import {FilterManager} from "./filter-manager.mjs";
import headerButton from "./header-button.mjs";
import {KeysDialog} from "./keys-dialog.mjs";
import {OptionalSelector} from "./optional-selector.mjs";
import {RollHooks} from "./roll-hooks.mjs";

export default {
  AppliedBonusesDialog,
  BabonusSheet,
  BabonusWorkshop,
  BonusCollector,
  CharacterSheetTab,
  KeysDialog,
  OptionalSelector,
  FilterManager,
  ...headerButton,
  RollHooks
};
