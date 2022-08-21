export class TRAIT_MAKER extends FormApplication {
    constructor(actor){
        super();
        this.actor = actor;
    }

    // the current bonuses on the actor.
    get bonuses(){
        const flag = this.actor.getFlag("babonus", "bonuses");
        let bonuses = [];
        if ( flag ){
            const {attack, damage, save} = flag;
            if( attack ) bonuses = bonuses.concat(Object.entries(attack).map(([
                identifier, {description, label, value}
            ]) => {
                return {identifier, description, label, value};
            }));
            if( damage ) bonuses = bonuses.concat(Object.entries(damage).map(([
                identifier, {description, label, value}
            ]) => {
                return {identifier, description, label, value};
            }));
            if( save ) bonuses = bonuses.concat(Object.entries(save).map(([
                identifier, {description, label, value}
            ]) => {
                return {identifier, description, label, value};
            }));
        }
        return bonuses;
    }

    // valid item types; those that can have actions associated.
    get itemTypes(){
        const types = [
            "weapon",
            "equipment",
            "consumable",
            "spell",
            "feat"
        ];
        return types.map(i => {
            const string = `DND5E.ItemType${i.titleCase()}`;
            const locale = game.i18n.localize(string);
            return {value: i, label: locale};
        });
    }

    get baseItems(){
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

    // get action types (subset of CONFIG.DND5E.itemActionTypes).
    get actionTypes(){
        const {itemActionTypes} = CONFIG.DND5E;
        const actions = [
            "heal", "msak", "mwak",
            "rsak", "rwak", "save"
        ];
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
        // filters:
        data.itemTypes = this.itemTypes;
        //data.toolTypes = this.baseItems_Tools;
        data.weaponTypes = this.baseItems;
        data.damageTypes = this.damageTypes;
        data.spellSchools = this.spellSchools;
        data.abilities = this.abilities;
        data.spellComponents = this.spellComponents;
        data.spellLevels = this.spellLevels;
        data.actionTypes = this.actionTypes;
        data.weaponProperties = this.weaponProperties;

        // current bonus being modified:
        data.current = {
            label: "name of the bonus...",
            identifier: "identifier of the bonus..."
        }

        // where to apply a bonus:
        data.bonusTargets = [
            {value: "attack", label: "Attack Rolls"},
            {value: "damage", label: "Damage Rolls"},
            {value: "save", label: "Save DC"}
        ];
        // what kind of bonus to apply:
        data.bonusTypes = [
            {value: "addition", label: "Addition"},
            {value: "modifier", label: "Dice Modifier"}
        ];

        data.bonuses = this.bonuses;

        return data;
    }

    static get defaultOptions(){
        return foundry.utils.mergeObject(super.defaultOptions, {
            closeOnSubmit: false,
            width: 600,
            template: "/modules/babonus/templates/buildflow.html",
            height: "auto",
            title: "Extended Traits"
        });
    }

    async _updateObject(event, obj){
		event.stopPropagation();
		const html = event.target;
		const button = event.submitter;
		if( !button ) return;

		// save the bonus.
		if( button.name === "babonus-save-button" ){
			let build = await this.build_a_bonus(html);
            this.setPosition();
            if ( !build ) return;
		}
        else return;
        
        this.setPosition();
        let data = await this.getData();
        this.render(true, data);
	}

	activateListeners(html){
		super.activateListeners(html);
		const app = this;
		html[0].addEventListener("click", async (event) => {
			const keyButton = event.target.closest("button.babonus-keys");
            if( !keyButton ) return;
			const type = keyButton.dataset.type;

            let before;
            if( type !== "weaponProperties" ) {
                before = `
                <div class="form-group">
                    <label>Name</label>
                    <div class="form-fields">
                        <label class="babonus-checkbox-100">Required</label>
                    </div>
                </div>`
            }
            else {
                before = `
                <div class="form-group">
                    <label>Name</label>
                    <div class="form-fields">
                        <label class="babonus-checkbox-100">Required</label>
                        <label class="babonus-checkbox-100">Unfit</label>
                    </div>
                </div>`
            }

            let semiList = await new Promise(resolve => {
                const items = app[type];
                const options = items.reduce((acc, {value, label}) => {
                    let boxes;
                    if( type !== "weaponProperties" ){
                        boxes = `<input class="babonus-checkbox-100" type="checkbox" id="${value}">`;
                    }
                    else {
                        boxes = `
                        <input class="babonus-checkbox-100" type="checkbox" id="${value}" data-property="required">
                        <input class="babonus-checkbox-100" type="checkbox" id="${value}" data-property="unfit">
                        `
                    }
                    return acc + `
                    <div class="form-group">
                        <label class="babonus-checkbox-100">${label}</label>
                        <div class="form-fields">
                            ${boxes}
                        </div>
                    </div>`;
                }, before);
                const content = `<form>${options}</form>`;
                new Dialog({
                    title: `Keys: ${type}`,
                    content,
                    buttons: {
                        apply: {
                            icon: `<i class="fas fa-check"></i>`,
                            label: "Apply Keys",
                            callback: (elements) => {
                                const nodes = elements[0].querySelectorAll("input[type='checkbox']:checked");
                                const checked = Array.from(nodes);
                                if ( type !== "weaponProperties" ){
                                    const keyString = checked.map(i => i.id).join(";");
                                    resolve(keyString);
                                }
                                else {
                                    const required = checked.filter(i => i.dataset.property === "required");
                                    const unfit = checked.filter(i => i.dataset.property === "unfit");
                                    resolve({
                                        required: required.map(i => i.id).join(";"),
                                        unfit: unfit.map(i => i.id).join(";")
                                    });
                                }
                            }
                        }
                    },
                    close: () => resolve(false)
                }).render(true);
            });
            if( !semiList ) return;

            if ( type !== "weaponProperties" ) {
                const input = html[0].querySelector(`[name="babonus-${type}"]`);
                input.value = semiList;
            }
            else {
                const required = html[0].querySelector("[name='babonus-weaponProperties-required']");
                const unfit = html[0].querySelector("[name='babonus-weaponProperties-unfit']");
                required.value = semiList.required;
                unfit.value = semiList.unfit;
            }
		});
	}

    // helper function to only use valid keys when setting flag.
    validateKeys(list, type){
        const ids = list.split(";");
        const values = this[type].map(i => i.value);
        const validIds = ids.filter(i => values.includes(i));
        return validIds;
    }

    async build_a_bonus(html){
        // base info:
        const bonusTarget = html.querySelector("[name='babonus-bonus-target']").value;
        const identifier = html.querySelector("[name='babonus-identifier']").value;
        const label = html.querySelector("[name='babonus-label']").value;
        const description = html.querySelector("[name='babonus-description']").value;
        const value = html.querySelector("[name='babonus-value']").value;
        const type = html.querySelector("[name='babonus-bonus-type']").value;

        const warningField = html.querySelector("[name='babonus-warning']");
        if ( !label ){
            warningField.innerText = "Your bonus needs a label!";
            warningField.classList.add("active");
            return false;
        }
        if ( !identifier ){
            warningField.innerText = "Your bonus needs an identifier!";
            warningField.classList.add("active");
            return false;
        }
        const alreadyIdentifierExist = this.actor.getFlag("babonus", `bonuses.${bonusTarget}.${identifier}`);
        if ( alreadyIdentifierExist && !this.editMode ){
            warningField.innerText = "A bonus with that identifier already exists!";
            warningField.classList.add("active");
            return false;
        }
        if ( !value ){
            warningField.innerText = "Your bonus needs a value!";
            warningField.classList.add("active");
            return false;
        }
        if ( !description ){
            warningField.innerText = "Your bonus needs a description!";
            warningField.classList.add("active");
            return false;
        }



        // filters:
        let filters = {};
        for( let filter of [
            "itemTypes", "baseItems", "damageTypes", "spellSchools",
            "abilities", "actionTypes", "spellLevels"
        ] ){
            let list = html.querySelector(`[name="babonus-${filter}"]`).value;
            if( !list ) continue;
            list = this.validateKeys(list, filter);
            if( list.length ) filters[filter] = list;
        }
        // these take special handling:
        for ( let filter of [
            "spellComponents", "weaponProperties-required", "weaponProperties-unfit"
        ] ){
            if ( filter === "spellComponents" ){
                let list = html.querySelector("[name='babonus-spellComponents']").value;
                if ( !list ) continue;
                list = this.validateKeys(list, "spellComponents");
                if( list.length ){
                    const matchType = html.querySelector("[name='babonus-spellComponents-match']").value;
                    filters["spellComponents"] = {
                        types: list,
                        match: matchType
                    }
                }
            }
            else if ( filter.startsWith("weaponProperties") ){
                let listRequired = html.querySelector("[name='babonus-weaponProperties-required']").value;
                let listUnfit = html.querySelector("[name='babonus-weaponProperties-unfit']").value;
                listRequired = this.validateKeys(listRequired, "weaponProperties");
                listUnfit = this.validateKeys(listUnfit, "weaponProperties");
                let weaponPropertes = {}
                if ( listRequired.length ) weaponPropertes.needed = listRequired;
                if ( listUnfit.length ) weaponPropertes.unfit = listUnfit;
                if ( !foundry.utils.isEmpty(weaponPropertes) ){
                    filters["weaponProperties"] = weaponPropertes;
                }
            }
        }

        if ( foundry.utils.isEmpty(filters) ){
            warningField.innerText = "Your bonus needs at least one filter!";
            warningField.classList.add("active");
            return false;
        }

        const data = {
            enabled: true,
            label,
            description,
            value,
            type,
            filters
        }
        
        warningField.classList.remove("active");
        await this.actor.setFlag("babonus", `bonuses.${bonusTarget}.${identifier}`, data);
        return true;
    }

    
}
