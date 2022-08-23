import { FILTER } from "./filters.mjs";

Hooks.on("dnd5e.preDisplayCard", (item, chatData, options) => {
    // get bonus:
    const bonuses = FILTER.mainCheck(item, "save");
    if ( !bonuses.length ) return;
    const totalBonus = bonuses.reduce((acc, {bonus}) => acc += Number(bonus), 0);

    // get all buttons.
    const html = chatData.content;
    const saveButtons = html[0].querySelectorAll("button[data-action=save]");

    // create label (innertext)
    const save = item.system.save;
    const abl = CONFIG.DND5E.abilities[save.ability] ?? "";
    const label = game.i18n.format("DND5E.SaveDC", {dc: save.dc + totalBonus || "", ability: abl});

    for(let btn of saveButtons) btn.innerText = label;
    // do I need to replace the chatData.content entirely?
    // if so: chatData.content = html;
});
