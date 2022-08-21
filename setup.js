import { TRAIT_MAKER } from "./scripts/trait-maker.mjs";

Hooks.on("setup", () => {
    CONFIG.DND5E.characterFlags["babonus"] = {
        name: "Build-a-Bonus",
        hint: "Open the build-a-bonus",
        section: "Build-a-Bonus",
        type: Boolean
    }
});

Hooks.on("renderActorSheetFlags", (sheet, html, flagData) => {
	const input = html[0].querySelector("input[name='flags.dnd5e.babonus']");
	const button = document.createElement("A");
	button.name = "flags.dnd5e.babonus";
	button.innerHTML = `<i class="fas fa-atlas"></i> Build-a-Bonus`;
	input.replaceWith(button);
	
	button.addEventListener("click", async () => {
        new TRAIT_MAKER(sheet.object).render(true);
    });
});