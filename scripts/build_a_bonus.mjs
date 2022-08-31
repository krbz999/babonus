import { handlingRegular, handlingSpecial } from "./constants.mjs";

export class Build_a_Bonus extends FormApplication {
    constructor(object, options){
        super(object, options);
        this.isItem = object.documentName === "Item";
    }

    static get defaultOptions(){
        return foundry.utils.mergeObject(super.defaultOptions, {
            closeOnSubmit: false,
            width: 450,
            template: "/modules/babonus/templates/build_a_bonus.html",
            height: "auto",
            classes: ["babonus"]
        });
    }

    get id(){
        return `babonus-build-a-bonus-${this.object.id}`;
    }

    // the types of bonuses ('attack', 'damage', 'save')
    get targets(){
        return [
            {value: "attack", label: game.i18n.localize("BABONUS.VALUES.TARGET_ATTACK")},
            {value: "damage", label: game.i18n.localize("BABONUS.VALUES.TARGET_DAMAGE")},
            {value: "save", label: game.i18n.localize("BABONUS.VALUES.TARGET_SAVE")}
        ];
    }

    // the current bonuses on the actor.
    get bonuses(){
        const flag = this.object.getFlag("babonus", "bonuses");
        let bonuses = [];
        if ( flag ){
            const {attack, damage, save} = flag;
            if( attack ) bonuses = bonuses.concat(Object.entries(attack).map(([identifier, {description, label, values, enabled}]) => {
                return {identifier, description, label, values, type: "attack", enabled};
            }));
            if( damage ) bonuses = bonuses.concat(Object.entries(damage).map(([identifier, {description, label, values, enabled}]) => {
                return {identifier, description, label, values, type: "damage", enabled};
            }));
            if( save ) bonuses = bonuses.concat(Object.entries(save).map(([identifier, {description, label, values, enabled}]) => {
                return {identifier, description, label, values, type: "save", enabled};
            }));
        }
        return bonuses;
    }

    // valid item types; those that can have actions associated.
    get itemTypes(){
        const types = [
            "consumable",
            "equipment",
            "feat",
            "spell",
            "weapon"
        ];
        return types.map(i => {
            const string = `DND5E.ItemType${i.titleCase()}`;
            const locale = game.i18n.localize(string);
            return {value: i, label: locale};
        });
    }

    get baseWeapons(){
        const entries = Object.entries(CONFIG.DND5E.weaponIds);
        const weapons = entries.map(([value, uuid]) => {
            const split = uuid.split(".");
            const id = split.pop();
            const packKey = split.length ? split.join(".") : "dnd5e.items";
            const {index} = game.packs.get(packKey);
            const {name} = index.find(({_id}) => {
                return _id === id;
            });
            return {value, label: name};
        });
        return weapons;
    }

    // get the types of damage, as well as healing and temp.
    get damageTypes(){
        const dTypes = Object.entries(CONFIG.DND5E.damageTypes);
        const hTypes = Object.entries(CONFIG.DND5E.healingTypes);
        const types = dTypes.concat(hTypes).map(([value, label]) => {
            return {value, label};
        });
        return types;
    }

    // get the spell schools available.
    get spellSchools(){
        const schools = Object.entries(CONFIG.DND5E.spellSchools);
        return schools.map(([value, label]) => {
            return {value, label};
        });
    }

    // get ability score keys.
    get abilities(){
        const abilities = Object.entries(CONFIG.DND5E.abilities);
        return abilities.map(([value, label]) => {
            return {value, label};
        });
    }
    // this uses the same as ability modifier.
    get saveAbilities(){
        return this.abilities;
    }

    // get spell component types.
    get spellComponents(){
        const comps = Object.entries(CONFIG.DND5E.spellComponents);
        const tags = Object.entries(CONFIG.DND5E.spellTags);
        return comps.concat(tags).map(([value, {label}]) => {
            return {value, label};
        });
    }

    // get spell levels.
    get spellLevels(){
        const levels = Object.entries(CONFIG.DND5E.spellLevels);
        return levels.map(([value, label]) => {
            return {value, label};
        });
    }

    // get attack types.
    get attackTypes(){
        const {itemActionTypes} = CONFIG.DND5E;
        const actions = ["msak", "mwak", "rsak", "rwak"];
        return actions.map(value => {
            const label = itemActionTypes[value];
            return {value, label};
        });
    }

    // get all weapon properties.
    get weaponProperties(){
        const properties = Object.entries(CONFIG.DND5E.weaponProperties);
        return properties.map(([value, label]) => {
            return {value, label};
        });
    }

    async getData(){
        const data = await super.getData();

        data.isItem = this.isItem;
        if ( data.isItem ) {
            data.canEquip = foundry.utils.hasProperty(this.object, "system.equipped");
            const {REQUIRED, ATTUNED} = CONFIG.DND5E.attunementTypes;
            data.canAttune = [REQUIRED, ATTUNED].includes(this.object.system.attunement);
        }

        // filters:
        data.damageTypes = this.damageTypes;
        data.abilities = this.abilities;
        data.attackTypes = this.attackTypes;
        
        data.spellComponents = this.spellComponents;
        data.spellLevels = this.spellLevels;
        data.spellSchools = this.spellSchools;
        data.weaponTypes = this.baseWeapons;
        data.weaponProperties = this.weaponProperties;

        // where to apply a bonus:
        data.targets = this.targets;
        // what kind of bonus to apply:
        data.itemTypes = this.itemTypes;
        // current bonuses.
        data.bonuses = this.bonuses;

        return data;
    }
    
    async _updateObject(event, obj){
		event.stopPropagation();
		const html = event.target;
		const button = event.submitter;
		if ( !button ) return;

		// save a bonus.
		if ( button.name === "babonus-save-button" ){
			let build = await this.build_a_bonus(html);
            if ( !build ) return;
		}
        // delete a bonus.
        else if ( button.name === "babonus-delete-button" ){
            button.setAttribute("disabled", "disabled");
            let prompt = await this.delete_a_bonus(button);
            button?.removeAttribute("disabled");
            if ( !prompt ) return;
        }
        else if ( button.name === "babonus-toggle-button" ){
            await this.toggle_a_bonus(button);
        }
        else return;
        
        this.setPosition();
        this.render()
	}

	activateListeners(html){
		super.activateListeners(html);
		const app = this;

        // KEYS buttons.
		html[0].addEventListener("click", async (event) => {
			const keyButton = event.target.closest("button.babonus-keys");
            if( !keyButton ) return;
			const type = keyButton.dataset.type;

            const types = foundry.utils.duplicate(app[type]);
            // find list.
            if ( type !== "weaponProperties") {
                let values = html[0].querySelector(`[name="babonus-${type}"]`).value.split(";");
                for( let t of types ){
                    if ( values.includes(t.value) ) t.checked = true;
                }
            }
            else {
                let needed = html[0].querySelector(`[name="babonus-weaponProperties-needed"]`).value.split(";");
                let unfit = html[0].querySelector(`[name="babonus-weaponProperties-unfit"]`).value.split(";");
                for ( let t of types ){
                    if ( needed.includes(t.value) ) t.needed = true;
                    if ( unfit.includes(t.value) ) t.unfit = true;
                }
            }

            const template = `/modules/babonus/templates/keys_${type}.hbs`;
            const content = await renderTemplate(template, {types});
            const title = game.i18n.localize(`BABONUS.KEY.${type}_TITLE`);

            const semiList = await app.applyKeys(title, content, type);

            if( !semiList || foundry.utils.isEmpty(semiList) ) return;

            if ( type !== "weaponProperties" ) {
                const input = html[0].querySelector(`[name="babonus-${type}"]`);
                input.value = semiList;
                if ( type === "itemTypes" ) this.refreshForm();
            }
            else {
                const needed = html[0].querySelector("[name='babonus-weaponProperties-needed']");
                const unfit = html[0].querySelector("[name='babonus-weaponProperties-unfit']");
                if ( semiList.needed ) needed.value = semiList.needed;
                if ( semiList.unfit) unfit.value = semiList.unfit;
            }
		});

        // EDIT buttons.
        html[0].addEventListener("click", async (event) => {
            const editButton = event.target.closest("button.babonus-edit");
            if( !editButton ) return;
			const formGroup = editButton.closest(".form-group");
            const bonusId = formGroup.dataset.id;
            const bonus = this.object.getFlag("babonus", `bonuses.${bonusId}`);
            
            // populate form:
            this.pasteValues(html, bonus, bonusId, true);
        });

        // COPY buttons.
        html[0].addEventListener("click", async (event) => {
            const copyButton = event.target.closest("button.babonus-copy");
            if( !copyButton ) return;
			const formGroup = copyButton.closest(".form-group");
            const bonusId = formGroup.dataset.id;
            const bonus = this.object.getFlag("babonus", `bonuses.${bonusId}`);
            
            // populate form:
            this.pasteValues(html, bonus, bonusId, false);
        });

        // slugify identifier.
        let idInput = html[0].querySelector("[name='babonus-identifier']");
        idInput.addEventListener("change", () => {
            idInput.value = idInput.value.slugify();
        });

        // on change listener for mandatory ItemTypes field, which populates the html with new inputs.
        // just set a class in the 'div.form'.
        const itemTypeInput = html[0].querySelector("[name='babonus-itemTypes']");
        itemTypeInput.addEventListener("change", () => this.refreshForm());
        const targetInput = html[0].querySelector("[name='babonus-target']");
        targetInput.addEventListener("change", () => this.refreshForm());
	}

    // async dialog helper for the Keys dialogs.
    async applyKeys(title, content, type){
        const app = this;
        class KeysDialog extends Dialog {
            constructor(obj, options){
                super(obj, options);
                this.object = obj.object;
                this.type = type;
            }
            get id(){
                return `babonus-keys-dialog-${this.object.id}-${this.type}`;
            }
        }
        return new Promise(resolve => {
            new KeysDialog({object: app.object, title, content,
                buttons: {
                    apply: {
                        icon: `<i class="fas fa-check"></i>`,
                        label: game.i18n.localize("BABONUS.KEY.APPLY"),
                        callback: (html) => {
                            const nodes = html[0].querySelectorAll("input[type='checkbox']:checked");
                            const checked = Array.from(nodes);
                            if ( type !== "weaponProperties" ){
                                const keyString = checked.map(i => i.id).join(";");
                                resolve(keyString);
                            }
                            else {
                                const needed = checked.filter(i => i.dataset.property === "needed").map(i => i.id).join(";");
                                const unfit = checked.filter(i => i.dataset.property === "unfit").map(i => i.id).join(";");
                                const res = {};
                                if ( needed ) res["needed"] = needed;
                                if ( unfit ) res["unfit"] = unfit;

                                resolve(res);
                            }
                        }
                    }
                },
                close: () => resolve(false)
            }).render(true);
        });
    }

    // helper function to only use valid keys when setting flag.
    validateKeys(list, type){
        const ids = list.split(";");
        const values = this[type].map(i => i.value);
        const validIds = ids.filter(i => values.includes(i));
        return validIds;
    }

    // method to take html, gather the inputs, and either update an existing bonus or create a new one.
    async build_a_bonus(html){

        // gather inputs.
        const inputs = this.retrieveValues(html);

        const warningField = html.querySelector("[name='babonus-warning']");

        if ( !inputs.label?.length ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_LABEL");
        if ( !inputs.identifier?.length ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_ID");
        const alreadyIdentifierExist = this.object.getFlag("babonus", `bonuses.${inputs.target}.${inputs.identifier}`);
        if ( alreadyIdentifierExist && !html.closest("form.babonus").classList.contains("editMode") ){
            return this.displayWarning(warningField, "BABONUS.WARNINGS.DUPLICATE_ID");
        }
        if ( !inputs.target?.length ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_TARGET");
        if ( foundry.utils.isEmpty(inputs.values) ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_BONUS");
        if ( !inputs.description?.length ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_DESC");
        if ( !inputs.itemTypes?.length ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_TYPE");
        if ( foundry.utils.isEmpty(inputs.filters) ) return this.displayWarning(warningField, "BABONUS.WARNINGS.MISSING_FILTER");
        

        // if inputs are valid:
        inputs.enabled = true;
        const id = inputs.identifier;
        delete inputs.identifier;
        
        warningField.classList.remove("active");
        await this.object.update({[`flags.babonus.bonuses.${inputs.target}.-=${id}`]: null});
        await this.object.setFlag("babonus", `bonuses.${inputs.target}.${id}`, inputs);
        html.closest("form.babonus").classList.remove("editMode");
        return true;
    }

    // method to delete a bonus when hitting the Trashcan button.
    async delete_a_bonus(button){
        const formGroup = button.closest(".form-group");
        const bonusId = formGroup.dataset.id;
        const bonus = this.object.getFlag("babonus", `bonuses.${bonusId}`);
        const label = bonus.label;

        const prompt = await new Promise(resolve => {
            new Dialog({
                title: game.i18n.format("BABONUS.DELETE.DELETE_BONUS", {label}),
                content: game.i18n.format("BABONUS.DELETE.ARE_YOU_SURE", {label}),
                buttons: {
                    yes: {
                        icon: `<i class="fas fa-trash"></i>`,
                        label: game.i18n.localize("Yes"),
                        callback: () => resolve(true)
                    },
                    no: {
                        icon: `<i class="fas fa-times"></i>`,
                        label: game.i18n.localize("No"),
                        callback: () => resolve(false)
                    }
                },
                close: () => resolve(false)
            }).render(true);
        });
        if ( !prompt ) return false;

        const target = bonusId.split(".")[0];
        const identifier = bonusId.split(".")[1];
        await this.object.update({[`flags.babonus.bonuses.${target}.-=${identifier}`]: null});
        return true;
    }

    async toggle_a_bonus(button){
        const formGroup = button.closest(".form-group");
        const bonusId = formGroup.dataset.id;
        const state = this.object.getFlag("babonus", `bonuses.${bonusId}.enabled`);
        return this.object.setFlag("babonus", `bonuses.${bonusId}.enabled`, !state);
    }

    

    // function that takes the html and returns all the values.
    retrieveValues(html){

        // mandatory fields:
        const label = html.querySelector("[name='babonus-label']").value;
        const identifier = html.querySelector("[name='babonus-identifier']").value;
        const target = html.querySelector("[name='babonus-target']").value;
        const description = html.querySelector("[name='babonus-description']").value;
        let itemTypes = html.querySelector("[name='babonus-itemTypes']").value;
        itemTypes = this.validateKeys(itemTypes, "itemTypes");
        const values = {};
        if ( target === "damage" ){
            const bonus = html.querySelector(".babonus-bonuses-damage [name='babonus-value']").value;
            if ( bonus ) values["bonus"] = bonus;
            const critDice = html.querySelector(".babonus-bonuses-damage [name='babonus-critical-dice']").value;
            if ( critDice ) values["criticalBonusDice"] = critDice;
            const critDamage = html.querySelector(".babonus-bonuses-damage [name='babonus-critical-damage']").value;
            if ( critDamage ) values["criticalBonusDamage"] = critDamage;
        }
        else if ( target === "attack" ){
            const bonus = html.querySelector(".babonus-bonuses-attack [name='babonus-value']").value;
            if ( bonus ) values["bonus"] = bonus;
        }
        else if ( target === "save" ){
            const bonus = html.querySelector(".babonus-bonuses-save [name='babonus-value']").value;
            if ( bonus ) values["bonus"] = bonus;
        }
        const itemRequirements = {
            equipped: !!html.querySelector("[name='babonus-equipped']")?.checked,
            attuned: !!html.querySelector("[name='babonus-attuned']")?.checked
        }

        // filters:
        let filters = {};
        for( let filter of handlingRegular ){
            let list = html.querySelector(`[name="babonus-${filter}"]`);
            if( !list.value || list.offsetParent === null ) continue; // if hidden
            list = this.validateKeys(list.value, filter);
            if( list.length ) filters[filter] = list;
        }
        // these take special handling:
        for ( let filter of handlingSpecial ){
            if ( filter === "spellComponents" ){
                let list = html.querySelector("[name='babonus-spellComponents']");
                if ( !list.value || list.offsetParent === null ) continue; // if hidden
                list = this.validateKeys(list.value, "spellComponents");
                if( list.length ){
                    const matchType = html.querySelector("[name='babonus-spellComponents-match']").value;
                    filters["spellComponents"] = { types: list, match: matchType }
                }
            }
            else if ( filter.startsWith("weaponProperties") ){
                let listNeeded = html.querySelector("[name='babonus-weaponProperties-needed']");
                let listUnfit = html.querySelector("[name='babonus-weaponProperties-unfit']");
                if ( listNeeded.offsetParent === null ) continue; // if hidden
                listNeeded = this.validateKeys(listNeeded.value, "weaponProperties");
                listUnfit = this.validateKeys(listUnfit.value, "weaponProperties");
                let weaponPropertes = {}
                if ( listNeeded.length ) weaponPropertes.needed = listNeeded;
                if ( listUnfit.length ) weaponPropertes.unfit = listUnfit;
                if ( !foundry.utils.isEmpty(weaponPropertes) ){
                    filters["weaponProperties"] = weaponPropertes;
                }
            }
            else if ( filter === "arbitraryComparison" ){
                let one = html.querySelector("[name='babonus-arbitraryComparisonOne']").value;
                let other = html.querySelector("[name='babonus-arbitraryComparisonOther']").value;
                let operator = html.querySelector("[name='babonus-arbitraryComparisonOperator']").value;
                if ( !one || !other ) continue;
                filters["arbitraryComparison"] = {one, other, operator};
            }
        }

        const finalObject = {label, identifier, target, values, description, itemTypes, filters};
        if ( this.isItem ) finalObject.itemRequirements = itemRequirements;
        return finalObject;
    }

    // helper method to place a warning in the BAB.
    displayWarning(field, warn){
        field.innerText = game.i18n.localize(warn);
        field.classList.add("active");
        this.setPosition();
        return false;
    }

    // function that takes the html, an object (the bonus), and its id and pastes the values into the form.
    // "edit": are we editing or copying?
    pasteValues(html, bonus, id, edit = true){
        const label = edit ? bonus.label : "";
        const target = id.split(".")[0];
        const identifier = edit ? id.split(".")[1] : "";
        
        // populate form:
        html[0].querySelector("[name='babonus-label']").value = label;
        html[0].querySelector("[name='babonus-identifier']").value = identifier;
        html[0].querySelector("[name='babonus-target']").value = target;
        html[0].querySelector("[name='babonus-description']").value = bonus.description;
        html[0].querySelector("[name='babonus-itemTypes']").value = bonus.itemTypes.join(";");
        if ( this.isItem ) {
            const equipped = html[0].querySelector("[name='babonus-equipped']");
            if ( equipped ) equipped.checked = bonus.itemRequirements?.equipped;
            const attuned = html[0].querySelector("[name='babonus-attuned']");
            if ( attuned ) attuned.checked = bonus.itemRequirements?.attuned;
        }


        if ( target === "damage" ){
            html[0].querySelector(".babonus-bonuses-damage [name='babonus-value']").value = bonus.values.bonus ?? "";
            html[0].querySelector(".babonus-bonuses-damage [name='babonus-critical-dice']").value = bonus.values.criticalBonusDice ?? "";
            html[0].querySelector(".babonus-bonuses-damage [name='babonus-critical-damage']").value = bonus.values.criticalBonusDamage ?? "";
        }
        else if ( target === "attack" ){
            html[0].querySelector(".babonus-bonuses-attack [name='babonus-value']").value = bonus.values.bonus ?? "";
        }
        else if ( target === "save" ){
            html[0].querySelector(".babonus-bonuses-save [name='babonus-value']").value = bonus.values.bonus ?? "";
        }
        
        for( let filter of handlingRegular ){
            let string = bonus.filters[filter]?.join(";");
            html[0].querySelector(`[name="babonus-${filter}"]`).value = string ? string : "";
        }
        if ( bonus.filters["spellComponents"] ){
            html[0].querySelector("[name='babonus-spellComponents']").value = bonus.filters["spellComponents"].types.join(";");
            html[0].querySelector("[name='babonus-spellComponents-match']").value = bonus.filters["spellComponents"].match;
        }
        if ( bonus.filters["weaponProperties"] ){
            html[0].querySelector("[name='babonus-weaponProperties-needed']").value = bonus.filters["weaponProperties"].needed?.join(";") ?? "";
            html[0].querySelector("[name='babonus-weaponProperties-unfit']").value = bonus.filters["weaponProperties"].unfit?.join(";") ?? "";
        }
        if ( bonus.filters["arbitraryComparison"] ){
            const {one, other, operator} = bonus.filters["arbitraryComparison"];
            html[0].querySelector("[name='babonus-arbitraryComparisonOne']").value = one;
            html[0].querySelector("[name='babonus-arbitraryComparisonOther']").value = other;
            html[0].querySelector("[name='babonus-arbitraryComparisonOperator']").value = operator;
        }
        
        if( !edit ) html[0].closest("form.babonus").classList.remove("editMode");
        else html[0].closest("form.babonus").classList.add("editMode");
        this.refreshForm();
    }

    // helper method to populate the BAB with new fields depending on the itemTypes selected.
    refreshForm(){
        const html = this.element;
        const itemTypeInput = html[0].querySelector("[name='babonus-itemTypes']");
        const targetInput = html[0].querySelector("[name='babonus-target']");
        const values = itemTypeInput.value.split(";").map(i => i.trim());
        const form = itemTypeInput.closest("form.babonus");
        for( let {value} of this.itemTypes ){
            if ( values.includes(value) ) form.classList.add(value);
            else form.classList.remove(value);
        }
        for ( let {value} of this.targets ){
            if ( targetInput.value === value ) form.classList.add(value);
            else form.classList.remove(value);
        }
        this.setPosition();
    }

}
