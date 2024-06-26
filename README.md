Interested in following along with development of any of my modules? Join the [Discord server](https://discord.gg/QAG8eWABGT).

<h1 style="text-align: center; font-size: 60px; border: none; font-weight: bold; font-style: italic;">Build-a-Bonus</h1>

<p style="text-align: center; font-style: italic;">2022 Package Jam winner of the 'Most Polished' category and runner-up for 'Best Package'</p>

<p>A module for the Foundry <code>dnd5e</code> system. After installing this module, you can find a 'Build-a-Bonus' application in any actor, item, or effect, as well as scene regions. This gives you the ability to apply a bonus to any attack roll, damage roll, saving throw DC, saving throw, ability check, or hit die roll, for bonuses that should apply only under specific circumstances.</p>

<p style="text-align: center"><img src="https://i.imgur.com/7F2BegP.png" style="border: none"></p>

<p>Any bonuses you create will automatically be calculated and applied when you perform a relevant roll. The module uses filters to determine when and if a bonus should be applied. For example:</p>
<ul>
<li>Implement the alchemist artificer's feature to add their intelligence modifier (<code>@abilities.int.mod</code>) to the damage rolls of all spell-type items, and have Build-a-Bonus filter the bonus so it only applies to spells, only if it deals acid, fire, necrotic, poison, or healing, and only if it has a material (M) component.</li>
<li>Give your wizard player a bonus to the saving throw DC with just divination spells, and make the bonus equal to the level of the spell (<code>@item.level</code>).</li>
<li>Give your magical pugilist a feature akin to Brutal Critical and have it apply only to melee spell attacks.</li>
<li>Give your paladin an aura that grants each enemy within 10 feet a &minus;2 to melee attack rolls.</li>
<li>Give your rogue player a magic item that creates a 15-foot radius template, inside which everyone gets a damage roll bonus equal to the rogue's sneak attack dice.</li>
</ul>
<p>The Build-a-Bonus has countless options for how or what to apply and when. Scroll down to the bottom for the full list.</p>

<h1 style="font-weight: bold;">How to Use</h1>
<p>Open any actor's sheet, any item sheet, or any effect config, then click the otter icon in the header. Choose the type of bonus you want to create, then fill out the name, description, and the bonus. Then start narrowing down when and how the bonus should apply, using the available filters.<p>
<p>As of foundry version 12, Build-a-Bonus also supports adding bonuses to Scene Regions. A button for this can be found in the region's sheet.</p>
<p>Below is an example using the artificer's <em>Alchemical Savant</em> feature.</p>

<p style="text-align: center"><img src="https://i.imgur.com/XAz02TI.png" style="border: none"></p>

<p style="text-align: center"><img src="https://i.imgur.com/AQqfmvF.png" style="border: none"></p>

<p style="text-align: center"><img src="https://i.imgur.com/lorQcCg.png" style="border: none"></p>

<h1>The Babonus Sheet</h1>

<h2>Description Tab</h2>
<p>This simple tab allows you to edit the displayed image and description of the bonus.</p>

<h2>Bonuses Tab</h2>
<p>This tab allows for configuring the bonus that should be applying, assuming all filters are matched. Some babonus types also support dice modifiers.</p>
<p>Depending on the type you choose, Build-a-Bonus can add on top of the value or roll, or even several kinds at once. For example, for attack rolls, you can add bonuses on top of the roll itself, but also increase the critical range and the fumble range. This can be roll data and scale values, such as <code>@abilities.int.mod</code>, or just integers or dice expressions.</p>
<p>For damage rolls and hit dice rolls, you can also affect die modifiers. The supported modifiers are minimum and maximum values, rerolling, and explosive dice, as well as the quantity of the dice, and the size of dice.</p>

<h2>Configuration and Filters Tabs</h2>
<p>These tabs are for configuring the filters on the babonus. The full list of filters can be found below.</p>
<p>For any fields that support roll data (such as bonuses or comparison fields detailed below), you can use the roll data of the target as well as your own; use roll data as you normally would, and for targets simply prefix with <code>@target</code>.</p>
<p>In addition, when a bonus is 'transferred' either via an effect being copied through a template aura or regular aura, the roll data used will be source's roll data, if any. This means that your paladin player can have their Aura of Protection set up using <code>@abilties.cha.mod</code> and all allies within the aura will receive a bonus equal to the paladin's Charisma modifier, not their own Charisma modifier.</p>
<p>One thing to keep in mind is that bonuses use the source's roll data, while the filters use the recipient's roll data.</p>

<h2>Advanced Tab</h2>
<p>This tab allows for toggling the bonus, making it exclusive to its parent item, making it opt-in, or configuring consumption or an aura.</p>
<p>You can set the bonus to act as an aura within a set range or within a template created by an item, and define if the aura should apply to allied targets, enemy targets, or all within range or within the template, and whether it applies to the owner or not. The bonus is applied when another token actor makes a relevant roll. The module never makes use of token movement to calculate ranges, so the usage of auras and templates is incredibly lightweight.</p>
<p>You can configure a list of effect statuses that prevent the aura from affecting targets and the owner (such as if the source of the aura is dead or unconscious). The Keys button on the sheet will help you pick out statuses from those that exist on the token HUD. The field itself is not validated; if you are able to give an effect a status of your own choosing, that is respected as well; simply write the status in the field.</p>
<p>Lastly, you can configure a non-template aura to require direct line of sight from the source token to the rolling token's actor, or to require an unobstructed path of movement.</p>
<p>If the bonus additively affects an attack roll, damage roll, saving throw, or ability check (adding a bonus on top), the bonus can be toggled to be optional. Other types of bonuses will apply regardless. The actor will then have the choice when adding the bonus, which is shown in the roll configuration dialog when making the roll.</p>
<p>If the bonus is optional as described above, the bonus can also be configured to consume limited uses, item quantity, spell slots, hit points, currencies, the active effect on which it is created, or even the inspiration granted to the character from the GM. You can configure the minimum required consumption, as well as the maximum if the bonus should scale. For example, if you create an item with 10 limited uses, a bonus of "1d6", configure that the bonus is optional, and consumes between 2 and 6 uses when opted into, the actor making the roll can easily add between 2d6 and 6d6 in the roll configuration dialog, and the expended uses are automatically subtracted. This works similarly for spell slots, instead using 1 slot and scaling with spell level. A bonus consuming its effect or GM inspiration cannot scale.</p>
<p>Lastly, you can toggle 'Optional' on regardless for a bonus that grants no properties or dice modifiers. This will give you the ability to toggle it as a 'Reminder', causing its text to display in the roll configuration dialog.</p>

<p style="text-align: center"><img src="https://i.imgur.com/Erpo2to.png" style="border: none"></p>

<h1 style="font-weight: bold;">Available Filters</h1>
<p>These are the available filters that narrow down if the bonus should apply when making a roll.</p>
<p><strong><em>Abilities.</em></strong> The ability score used for the roll. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons using either Strength or Dexterity.</p>
<p><strong><em>Arbitrary Comparisons.</em></strong> An array of arbitrary comparisons you can use for anything that is not covered in the Build-a-Bonus natively. This supports numbers, roll data, and strings. If you enter strings, you can use the inequalities to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor performing the roll. For example, you can have a bonus apply only when the actor is below full health with <code>@attributes.hp.value <= @attributes.hp.max</code>. Unlike other filters, you can add this filter to the builder multiple times.</p>
<p><strong><em>Attack Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has an attack roll of that specific kind.</p>
<p><strong><em>Available Spell Slots.</em></strong> Filter the bonus to apply only if the actor performing the roll has more than the set minimum amount of spell slots available and/or less than the set maximum amount of spell slots available. Not both fields are required.</p>
<p><strong><em>Base Armors.</em></strong> Filter the bonus to only apply if the actor is wearing a specific type of armor or a shield.</p>
<p><strong><em>Target Armors.</em></strong> Filter the bonus to only apply if the user's current target is wearing a specific type of armor or a shield.</p>
<p><strong><em>Base Tools.</em></strong> The type of tool the item must be for the bonus to apply. For example Herbalism Kit, Thieves' Tools, or Cobbler's Tools.</p>
<p><strong><em>Base Weapons.</em></strong> Filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'.</p>
<p><strong><em>Conditions (Target).</em></strong> Filter the bonus to only apply if the target (of the client performing the roll) is affected by any of the included status conditions while having none of the excluded status conditions.</p>
<p><strong><em>Conditions.</em></strong> Filter the bonus to only apply if the actor is affected by any of the included status conditions while having none of the excluded status conditions. This uses the statuses stored in status conditions, as detailed above.</p>
<p><strong><em>Creature Sizes.</em></strong> Filter the bonus to only apply if the actor performing the roll is a certain size, like medium, huge, or gargantuan.</p>
<p><strong><em>Creature Types (Target).</em></strong> Filter the bonus to only apply if you are targeting an enemy belonging to one of the included creature types, such as 'undead', 'fey', or 'humanoid', while not targeting any of the excluded creature types.</p>
<p><strong><em>Creature Types.</em></strong> Filter the bonus to only apply if you are belonging to one of the included creature types, such as 'undead', 'fey', or 'humanoid', while not belonging to any of the excluded creature types.</p>
<p><strong><em>Custom Scripts.</em></strong> A blank text field for users to write any JavaScript code they like. The script must be fully synchronous and return true or false. The available variables declared for the script will vary by the roll type, but <code>actor</code>, <code>item</code>, <code>token</code>, and <code>bonus</code> are always provided if possible, as well as an object, <code>details</code>, used for the iteration of parsing the validity of the bonuses. For those uncomfortable with having all clients execute these scripts, a setting is available for the module which will completely ignore the scripts and simply immediately return true.</p>
<p><strong><em>Damage Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has a damage formula with any of the included damage types while having none of the excluded damage types.</p>
<p><strong><em>Feature Types.</em></strong> Filter the bonus to only apply if the item used to perform the attack or damage roll (or prompt for a saving throw) is a feature-type item of a specific type, and optionally also a specific subtype.</p>
<p><strong><em>Health Percentages.</em></strong> A percentage value and whether the actor must have at least or at most this amount of remaining hit points for the bonus to apply.</p>
<p><strong><em>Item Types.</em></strong> The type of item the bonus should apply to. For example if you want to increase the save DC globally but only for equipment type items, not spells.</p>
<p><strong><em>Proficiency Levels.</em></strong> The level of proficiency that the actor must have with the roll made. This is available for ability checks, saving throws, and attack rolls.</p>
<p><strong><em>Save DC Ability.</em></strong> Filter the bonus such that it only applies if the DC is set using a specific ability. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'.</p>
<p><strong><em>Saving Throw Types.</em></strong> The type of saving throw the bonus should apply to (any ability score as well as death saving throws). If you are using the module Concentration Notifier, you can also apply a bonus specifically to saves for maintaining concentration.</p>
<p><strong><em>Skills.</em></strong> The type of skill the roll must be for the bonus to apply. For example Athletics, Nature, or Survival.</p>
<p><strong><em>Spell Components.</em></strong> Filter the bonus to only apply if the item is a spell that has any one (or all) of the given components.</p>
<p><strong><em>Spell Levels.</em></strong> Filter the bonus to only apply if the item is a spell and is or was cast at one of the given levels.</p>
<p><strong><em>Spell Preparation Modes.</em></strong> Filter the bonus to only apply if the item is a spell and is set as one of a selected few preparation modes such as 'pact magic' or 'innate'.</p>
<p><strong><em>Spell Schools.</em></strong> Filter the bonus to only apply if the item is a spell belonging to one of the given spell schools.</p>
<p><strong><em>Spoken Languages.</em></strong> Filter the bonus to only apply if the actor performing the roll is able to speak a certain language.</p>
<p><strong><em>Token Sizes (Target).</em></strong> Filter the bonus to only apply if the target (of the client performing the roll) is a token of a certain size or greater (or smaller), and optionally clamped using the roller's token's size.</p>
<p><strong><em>Weapon Properties.</em></strong> Filter the bonus to only apply if the item is a weapon that has at least one of the included weapon properties while having none of the excluded properties.</p>

<h1 style="font-weight: bold;">API</h1>
<p>An API can be accessed at <code>game.modules.get("babonus").api</code> or through the global namespace <code>babonus</code>. The parameter <code>object</code> below refers to an Actor, ActiveEffect, Item, or MeasuredTemplateDocument. The methods are currently:</p>

```js
/**
 * Return the collection of bonuses on the document.
 * @param {Document} object           An actor, item, effect, template, or region.
 * @returns {Collection<Babonus>}     A collection of babonuses.
 */
function getCollection(object)
```

```js
/**
 * Return a babonus using its uuid.
 * @param {string} uuid                 The babonus uuid.
 * @returns {Promise<Babonus|null>}     The found babonus.
 */
async function fromUuid(uuid)
```

```js
/**
 * Return a babonus using its uuid.
 * @param {string} uuid         The babonus uuid.
 * @returns {Babonus|null}      The found babonus.
 */
function fromUuidSync(uuid)
```

```js
/**
 * Create a babonus in memory with the given data.
 * @param {object} data           An object of babonus data.
 * @param {Document} [parent]     The document to act as parent of the babonus.
 * @returns {Babonus}             The created babonus.
 */
function createBabonus(data, parent = null)
```

```js
/**
 * Duplicate a bonus.
 * @param {Babonus} bonus           The bonus to duplicate.
 * @returns {Promise<Babonus>}      The duplicate.
 */
function duplicateBonus(bonus)
```

```js
/**
 * Embed a created babonus onto the target object.
 * @param {Document} object         The actor, item, effect, or region that should have the babonus.
 * @param {Babonus} bonus           The created babonus.
 * @returns {Promise<Document>}     The actor, item, effect, or region that has received the babonus.
 */
async function embedBabonus(object, bonus)
```

```js
/**
 * Return an object of arrays of items and effects on the given document
 * that have one or more babonuses embedded in them.
 * @param {Document} object     An actor or item with embedded documents.
 * @returns {object}            An object with an array of effects and array of items.
 */
function findEmbeddedDocumentsWithBonuses(object)
```

```js
/**
 * Render the build-a-bonus application for a document.
 * @param {Document} object       An actor, item, effect, or region.
 * @returns {BabonusWorkshop}     The rendered workshop.
 */
function openBabonusWorkshop(object)
```

```js
/**
 * Does this actor speak a given language?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The language to test.
 * @returns {boolean}
 */
function speaksLanguage(actor, trait)
```

```js
/**
 * Does this actor have a given weapon proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasWeaponProficiency(actor, trait)
```

```js
/**
 * Does this actor have a given armor proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasArmorProficiency(actor, trait)
```

```js
/**
 * Does this actor have a given tool proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasToolProficiency(actor, trait)
```

```js
/**
 * Retrieve a path through nested proficiencies to find a specific proficiency in a category.
 * E.g., 'smith' and 'tool' will return ['art', 'smith'], and 'aquan' and 'languages' will
 * return ['exotic', 'primordial', 'aquan'].
 * @param {string} key          The specific proficiency (can be a category), e.g., "smith" or "primordial".
 * @param {string} category     The trait category, e.g., "tool", "weapon", "armor", "languages".
 * @returns {string[]}
 */
function proficiencyTree(key, category)
```

```js
/**
 * Hotbar method for toggling a bonus via uuid.
 * @param {string} uuid       Uuid of the bonus to toggle.
 * @returns {Promise<null|Babonus>}
 */
async function hotbarToggle(uuid)
```

<p>Within the API's <code>filters</code> object, you can find all the filtering functions used by the module internally. They are too numerous to list here.</p>

<h2>Instance Methods</h2>
<p>Instance methods are functions found directly on an instance of a created bonus.</p>
<ul>
<li><code>Babonus#toggle</code> enables or disables the bonus on its parent.</li>
<li><code>Babonus#update</code> updates the bonus itself with the given new properties.</li>
<li><code>Babonus#delete</code> removes the bonus off of its parent.</li>
</ul>

<h1 style="font-weight: bold;">Hooks</h1>

<p>The below hook is called during appliction of an optional bonus.</p>

```js
/**
 * A hook that is called after an actor, item, or effect is updated or deleted, but before any bonuses are applied.
 * @param {Babonus} babonus                             The babonus that holds the optional bonus to apply.
 * @param {Actor5e|Item5e} roller                       The actor or item performing a roll or usage.
 * @param {Actor5e|Item5e|ActiveEffect5e} [target]      The actor or item that was updated or deleted, if any.
 * @param {object} config
 * @param {string} config.bonus                         The bonus that will be applied.
 * @returns {boolean}                                   Explicitly return false to cancel the application of the bonus.
 */
```

<p>Two hooks are called during the filtering of the collected bonuses when making a relevant roll.</p>

```js
/**
 * A hook that is called before the collection of bonuses has been filtered.
 * @param {Collection<Babonus>} bonuses     The collection of bonuses, before filtering.
 * @param {Actor5e|Item5e} object           The actor or item performing the roll.
 * @param {object} [details]                Additional data passed along to perform the filtering.
 * @param {string} hookType                 The type of hook being executed ('attack',
 *                                          'damage', 'save', 'throw', 'test', 'hitdie').
 */
Hooks.callAll("babonus.preFilterBonuses", bonuses, object, details, hookType);
```

```js
/**
 * A hook that is called after the collection of bonuses has been filtered.
 * @param {Collection<Babonus>} bonuses     The array of bonuses, after filtering.
 * @param {Actor5e|Item5e} object           The actor or item performing the roll.
 * @param {object} [details]                Additional data passed along to perform the filtering.
 * @param {string} hookType                 The type of hook being executed ('attack',
 *                                          'damage', 'save', 'throw', 'test', 'hitdie').
 */
Hooks.callAll("babonus.filterBonuses", bonuses, object, details, hookType);
````
