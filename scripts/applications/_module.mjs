import {BabonusSheet} from "./babonus-sheet.mjs";
import {BabonusWorkshop} from "./babonus-workshop.mjs";
import {BonusCollector} from "./bonus-collector.mjs";
import {CharacterSheetTab} from "./character-sheet-tab.mjs";
import {FilterManager} from "./filter-manager.mjs";
import headerButton from "./header-button.mjs";
import {KeysDialog} from "./keys-dialog.mjs";
import {RollHooks} from "./roll-hooks.mjs";
import TokenAura from "./token-aura.mjs";

export default {
  BabonusSheet,
  BabonusWorkshop,
  BonusCollector,
  CharacterSheetTab,
  KeysDialog,
  FilterManager,
  ...headerButton,
  RollHooks,
  TokenAura
};
