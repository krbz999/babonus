import { handlingRegular, handlingSpecial, MATCH, MODULE } from "./constants.mjs";

export class Build_a_Bonus extends FormApplication {
    constructor(object, options){
        super(object, options);
        this.isItem = object.documentName === "Item";
    }

    static get defaultOptions(){
        return foundry.utils.mergeObject(super.defaultOptions, {
            closeOnSubmit: false,
            width: 450,
            template: `/modules/${MODULE}/templates/build_a_bonus.html`,
            height: "auto",
            classes: [MODULE]
        });
    }

    get id(){
        return `${MODULE}-build-a-bonus-${this.object.id}`;
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
        const flag = this.object.getFlag(MODULE, "bonuses");
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

    // get all status effects.
    get statusEffects(){
        const effects = CONFIG.statusEffects;
        const ids = effects.reduce((acc, {id}) => {
            if ( id ) acc.push(id);
            return acc;
        }, []);
        return ids.map((id) => ({ value: id, label: id }));
    }

    async getData(){
        const data = await super.getData();

        data.isItem = this.isItem;
        if ( data.isItem ) {
            data.canEquip = foundry.utils.hasProperty(this.object, "system.equipped");
            const {REQUIRED, ATTUNED} = CONFIG.DND5E.attunementTypes;
            data.canAttune = [REQUIRED, ATTUNED].includes(this.object.system.attunement);
        }
        data.targets = this.targets;
        data.bonuses = this.bonuses;

        return data;
    }
    
    async _updateObject(event, formData){
        event.stopPropagation();
        const button = event.submitter;
        if ( !button ) return;

        // save a bonus.
        if ( button.name === "babonus-save-button" ) {
            const build = await this.build_a_bonus(formData);
            if ( !build ) return;
        }
        
        else return;
        
        this.setPosition();
        this.render()
    }

    async _onChangeInput(event){
        if ( event ) {
            await super._onChangeInput(event);
            // hide/unhide some elements.
            if ( ["target", "itemTypes"].includes(event.target.name) ) {
                this.refreshForm();
            }
        }
        // enable/disable all shown/hidden elements.
        const inputs = ["INPUT", "SELECT"];
        for ( const input of inputs ) {
            const elements = this.element[0].getElementsByTagName(input);
            for ( const element of elements ) {
                element.disabled = element.offsetParent === null;
            }
        }
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
                let input = html[0].querySelector(`[name="filters.${type}"]`);
                if ( !input ) input = html[0].querySelector(`[name="${type}"]`);
                if ( !input ) input = html[0].querySelector(`[name="filters.${type}.types"]`); // for spellComps.
                const values = input.value.split(";");
                for( const t of types ) {
                    t.checked = values.includes(t.value);
                }
            } else {
                const needed = html[0].querySelector(`[name="filters.weaponProperties.needed"]`).value.split(";");
                const unfit = html[0].querySelector(`[name="filters.weaponProperties.unfit"]`).value.split(";");
                // for checkboxes:
                for ( const t of types ) {
                    t.needed = needed.includes(t.value);
                    t.unfit = unfit.includes(t.value);
                }
            }

            const template = `/modules/${MODULE}/templates/keys_${type}.hbs`;
            const content = await renderTemplate(template, {types});
            const title = game.i18n.localize(`BABONUS.KEY.${type}_TITLE`);

            const semiList = await app.applyKeys(title, content, type);

            if ( semiList === false || foundry.utils.isEmpty(semiList) ) return;

            if ( type !== "weaponProperties" ) {
                let input = html[0].querySelector(`[name="filters.${type}"]`);
                if ( !input ) input = html[0].querySelector(`[name="${type}"]`);
                if ( !input ) input = html[0].querySelector(`[name="filters.${type}.types"]`); // for spellComps.
                input.value = semiList;
                if ( type === "itemTypes" ) this.refreshForm();
            }
            else {
                const needed = html[0].querySelector("[name='filters.weaponProperties.needed']");
                const unfit = html[0].querySelector("[name='filters.weaponProperties.unfit']");
                needed.value = semiList.needed;
                unfit.value = semiList.unfit;
            }
        });

        // EDIT buttons.
        html[0].addEventListener("click", async (event) => {
            const editButton = event.target.closest("a.babonus-edit");
            if( !editButton ) return;
            const formGroup = editButton.closest(".form-group");
            const bonusId = formGroup.dataset.id;
            const bonus = this.object.getFlag(MODULE, `bonuses.${bonusId}`);
            
            // populate form:
            this.pasteValues(html, bonus, bonusId, true);
        });

        // COPY buttons.
        html[0].addEventListener("click", async (event) => {
            const copyButton = event.target.closest("a.babonus-copy");
            if( !copyButton ) return;
            const formGroup = copyButton.closest(".form-group");
            const bonusId = formGroup.dataset.id;
            const bonus = this.object.getFlag(MODULE, `bonuses.${bonusId}`);
            
            // populate form:
            this.pasteValues(html, bonus, bonusId, false);
        });

        // TOGGLE buttons.
        html[0].addEventListener("click", async (event) => {
            const toggleButton = event.target.closest("a.babonus-toggle");
            if ( !toggleButton ) return;
            await this.toggle_a_bonus(toggleButton);
            
            this.setPosition();
            this.render();
        });

        // DELETE buttons.
        html[0].addEventListener("click", async (event) => {
            const deleteButton = event.target.closest("a.babonus-delete");
            if ( !deleteButton ) return;
            deleteButton.style.pointerEvents = "none";
            const prompt = await this.delete_a_bonus(deleteButton);
            if ( deleteButton ) deleteButton.style.pointerEvents = "";
            if ( !prompt ) return;

            this.setPosition();
            this.render();
        });

        // slugify identifier.
        let idInput = html[0].querySelector("[name='identifier']");
        idInput.addEventListener("change", () => {
            idInput.value = idInput.value.slugify();
        });
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
                return `${MODULE}-keys-dialog-${this.object.id}-${this.type}`;
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
                                const keyString = checked.map(i => i.id).join(";") ?? "";
                                resolve(keyString);
                            }
                            else {
                                const needed = checked.filter(i => i.dataset.property === "needed").map(i => i.id).join(";");
                                const unfit = checked.filter(i => i.dataset.property === "unfit").map(i => i.id).join(";");
                                const res = { needed, unfit };

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
        if ( !list ) return [];
        const ids = list.split(";");
        const values = this[type].map(i => i.value);
        const validIds = ids.filter(i => values.includes(i));
        return validIds;
    }

    // method to take html, gather the inputs, and either update an existing bonus or create a new one.
    async build_a_bonus(formData){
        // gather inputs.
        const inputs = this.retrieveValues(formData);

        // the bonus needs a label.
        if ( !inputs.label?.length ) return this.displayWarning("BABONUS.WARNINGS.MISSING_LABEL");

        // the bonus needs an identifier.
        if ( !inputs.identifier?.length ) return this.displayWarning("BABONUS.WARNINGS.MISSING_ID");

        // the bonus cannot have a duplicate identifier (unless in edit mode).
        const alreadyIdentifierExist = this.object.getFlag(MODULE, `bonuses.${inputs.target}.${inputs.identifier}`);
        if ( alreadyIdentifierExist && !this.element[0].querySelector("form.babonus").classList.contains("editMode") ) {
            return this.displayWarning("BABONUS.WARNINGS.DUPLICATE_ID");
        }

        // the bonus needs a target.
        if ( !inputs.target?.length ) return this.displayWarning("BABONUS.WARNINGS.MISSING_TARGET");

        // the bonus needs a bonus.
        if ( foundry.utils.isEmpty(inputs.values) ) return this.displayWarning("BABONUS.WARNINGS.MISSING_BONUS");

        // the bonus needs a description.
        if ( !inputs.description?.length ) return this.displayWarning("BABONUS.WARNINGS.MISSING_DESC");

        // the bonus needs item types.
        if ( !inputs.itemTypes?.length ) return this.displayWarning("BABONUS.WARNINGS.MISSING_TYPE");

        // the bonus needs at least one filter.
        if ( foundry.utils.isEmpty(inputs.filters) ) return this.displayWarning("BABONUS.WARNINGS.MISSING_FILTER");
        

        // if inputs are valid:
        inputs.enabled = true;
        const id = inputs.identifier;
        delete inputs.identifier;
        
        // remove the warning field.
        this.displayWarning(false);

        // replace the old bonus (doesn't matter if it existed before).
        await this.object.update({[`flags.${MODULE}.bonuses.${inputs.target}.-=${id}`]: null});
        await this.object.setFlag(MODULE, `bonuses.${inputs.target}.${id}`, inputs);
        this.element[0].classList.remove("editMode");
        return true;
    }

    // method to delete a bonus when hitting the Trashcan button.
    async delete_a_bonus(button){
        const formGroup = button.closest(".form-group");
        const bonusId = formGroup.dataset.id;
        const bonus = this.object.getFlag(MODULE, `bonuses.${bonusId}`);
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
        await this.object.update({[`flags.${MODULE}.bonuses.${target}.-=${identifier}`]: null});
        return true;
    }

    async toggle_a_bonus(button){
        const formGroup = button.closest(".form-group");
        const bonusId = formGroup.dataset.id;
        const state = this.object.getFlag(MODULE, `bonuses.${bonusId}.enabled`);
        await this.object.setFlag(MODULE, `bonuses.${bonusId}.enabled`, !state);
        this.render();
        return true;
    }
    
    // function that takes the formData and scrubs unwanted or empty values.
    retrieveValues(formData){

        const bonusData = foundry.utils.expandObject(formData);
        bonusData.itemTypes = this.validateKeys(bonusData.itemTypes, "itemTypes");
        if ( bonusData.values?.bonus ) {
            bonusData.values.bonus = bonusData.values?.bonus.find(i => i);
            if ( !Object.values(bonusData.values).filter(i => !!i).length ) {
                delete bonusData.values;
            }
        }
        
        // filters:
        for ( const filter of handlingRegular ) {
            bonusData.filters[filter] = this.validateKeys(bonusData.filters[filter], filter);
            if ( !bonusData.filters[filter]?.length ) delete bonusData.filters[filter];
        }
        
        // these take special handling:
        for ( const filter of handlingSpecial ) {
            if ( filter === "spellComponents" ) {
                const as = bonusData.filters[filter];
                if ( !as ) continue;
                as.types = this.validateKeys(as.types, filter);
                if ( !as.types.length ) delete bonusData.filters[filter];
            } else if ( filter === "weaponProperties" ) {
                const as = bonusData.filters["weaponProperties"];
                if ( !as ) continue;
                as.needed = this.validateKeys(as.needed, "weaponProperties");
                as.unfit = this.validateKeys(as.unfit, "weaponProperties");
                if ( !as.needed.length ) delete bonusData.filters["weaponProperties"].needed;
                if ( !as.unfit.length ) delete bonusData.filters["weaponProperties"].unfit;
                if ( foundry.utils.isEmpty(as) ) delete bonusData.filters["weaponProperties"];
            } else if ( filter === "arbitraryComparison" ) {
                const { one, other } = bonusData.filters[filter];
                if ( !one || !other ) delete bonusData.filters[filter];
            }
        }

        return bonusData;
    }

    // helper method to place or remove a warning in the BAB.
    displayWarning(warn){
        const field = this.element[0].querySelector("[name='babonus-warning']");
        if ( warn === false ) {
            field.classList.remove("active");
            return true;
        }
        field.innerText = game.i18n.localize(warn);
        field.classList.add("active");
        this.setPosition();
        return false;
    }

    /**
     * A helper function to fill out the form with an existing bonus from the document.
     * 
     * @param {HTML} html           The html of the form.
     * @param {Object} flagBonus    The bonus of the document.
     * @param {String} id           The id of the bonus, also contains the target.
     * @param {Boolean} edit        Whether this is a bonus being edited or copied.
     */
    pasteValues(html, flagBonus, id, edit = true){
        const bonus = foundry.utils.duplicate(flagBonus);

        if ( edit ) {
            bonus.identifier = id.split(".")[1];
        } else {
            bonus.label = "";
            bonus.identifier = "";
        }
        bonus.target = id.split(".")[0];

        /**
         * Paste values into the form for the basic string inputs
         * that are not converted between strings and arrays.
         */
        for ( const key of ["label", "identifier", "target", "description"] ) {
            html[0].querySelector(`[name='${key}']`).value = bonus[key];
        }
        html[0].querySelector("[name='itemTypes']").value = bonus.itemTypes.join(";");
        
        if ( this.isItem ) {
            const equipped = html[0].querySelector("[name='itemRequirements.equipped']");
            if ( equipped ) equipped.checked = !!bonus.itemRequirements?.equipped;
            const attuned = html[0].querySelector("[name='itemRequirements.attuned']");
            if ( attuned ) attuned.checked = !!bonus.itemRequirements?.attuned;
        }
        
        if ( bonus.target === "damage" ) {
            html[0].querySelector(".babonus-bonuses-damage [name='values.bonus']").value = bonus.values.bonus ?? "";
            html[0].querySelector("[name='values.criticalBonusDice']").value = bonus.values.criticalBonusDice ?? "";
            html[0].querySelector("[name='values.criticalBonusDamage']").value = bonus.values.criticalBonusDamage ?? "";
        } else if ( bonus.target === "attack" ) {
            html[0].querySelector(".babonus-bonuses-attack [name='values.bonus']").value = bonus.values.bonus ?? "";
        } else if ( bonus.target === "save" ) {
            html[0].querySelector(".babonus-bonuses-save [name='values.bonus']").value = bonus.values.bonus ?? "";
        }
        
        // filters whose values should just be joined by semicolon in a text field.
        for ( const filter of handlingRegular ) {
            const string = bonus.filters[filter]?.join(";");
            html[0].querySelector(`[name="filters.${filter}"]`).value = string ?? "";
        }
        // special handling.
        html[0].querySelector("[name='filters.spellComponents.types']").value = bonus.filters["spellComponents"]?.types.join(";") ?? "";
        html[0].querySelector("[name='filters.spellComponents.match']").value = bonus.filters["spellComponents"]?.match ?? MATCH.ANY;
        html[0].querySelector("[name='filters.weaponProperties.needed']").value = bonus.filters["weaponProperties"]?.needed?.join(";") ?? "";
        html[0].querySelector("[name='filters.weaponProperties.unfit']").value = bonus.filters["weaponProperties"]?.unfit?.join(";") ?? "";
        const {one, other, operator} = bonus.filters["arbitraryComparison"] ?? {};
        html[0].querySelector("[name='filters.arbitraryComparison.one']").value = one ?? "";
        html[0].querySelector("[name='filters.arbitraryComparison.other']").value = other ?? "";
        html[0].querySelector("[name='filters.arbitraryComparison.operator']").value = operator ?? "EQ";
        
        if ( !edit ) html[0].closest("form.babonus").classList.remove("editMode");
        else html[0].closest("form.babonus").classList.add("editMode");
        this.refreshForm();
    }

    // helper method to populate the BAB with new fields depending on the itemTypes selected.
    refreshForm(){
        const html = this.element;
        const itemTypeInput = html[0].querySelector("[name='itemTypes']");
        const targetInput = html[0].querySelector("[name='target']");
        const values = itemTypeInput.value.split(";").map(i => i.trim());
        const form = itemTypeInput.closest("form.babonus");
        for ( const {value} of this.itemTypes ) {
            if ( values.includes(value) ) form.classList.add(value);
            else form.classList.remove(value);
        }
        for ( const {value} of this.targets ) {
            if ( targetInput.value === value ) form.classList.add(value);
            else form.classList.remove(value);
        }
        this.setPosition();
        this._onChangeInput();
    }

}
