# Build-a-Bonus

<p align="center">
<em>2022 Package Jam winner of the 'Most Polished' category and runner-up for 'Best Package'</em>
</p>

A module for the Foundry dnd5e system. After installing this module, you can find a 'Build-a-Bonus' application in any actor's Special Traits, in the header of any item, or in the header of any Active Effect. This gives you the ability to apply a bonus to any attack roll, damage roll, saving throw DC, saving throw, or hit die roll, for bonuses that should apply only under specific circumstances. If a bonus is embedded in an item or effect, they transfer with the item/effect if placed on another actor.

<p align="center">
  <img src="https://i.imgur.com/PEtyFfQ.png">
</p>

Any bonuses you create will automatically be calculated when you perform an attack roll, damage roll, when you use an item that has a saving throw, when you perform a saving throw yourself, or when you roll a hit die. For example:
- Implement the alchemist artificer's feature to add their intelligence modifier (`@abilities.int.mod`) to the damage rolls of all Spell-type items, and have Build-a-Bonus filter the bonus so it only applies to spells, only if it deals acid, fire, necrotic, poison, or healing, and only if it has a material (M) component.
- Give your wizard player a bonus to the saving throw DC with just Divination spells, and equal to the level of the spell.
- Give your magical pugilist a feature akin to Brutal Critical and have it apply only to melee spell attacks.
- Give your paladin an aura that grants each enemy within 10 feet a -2 to melee attack rolls.

The Build-a-Bonus has countless options for how or what to apply and when. Scroll down to the bottom for the full list.

<p align="center">
  <img src="https://i.imgur.com/Ygf0fPE.png">
</p>

## How to Use
Open any actor's sheet, then find the Special Traits (on the main tab of the actor sheet if using the core dnd5e sheet) and find the Build-a-Bonus workshop, or click the icon in the header of an item or active effect. Choose the type of bonus you want to create (attack roll, damage roll, save dc, saving throws, or hit die rolls), then fill out the required fields (name and description), and then start narrowing down when the bonus should apply, using the available filters that you can pick and choose from on the right. If you need additional hints, hover over any of the labels and tooltips. Not all filters are available for each type of bonus. Below is an example using the artificer's Alchemical Savant feature.

<p align="center">
  <img src="https://i.imgur.com/OnLz50Y.png">
</p>

Once you are done creating the bonus, save it, and your actor should now have their bonus apply when they perform teh relevant roll, given that they match the filters of the bonus.

## The Full Choice List
This is the full array of filters and choices you can make in the Build-a-Bonus. For any fields that support roll data (such as bonuses or comparison fields detailed below), you can use the roll data of the target as well as your own; use roll data as you normally would, simply prefixed with `@target`.

### Required fields
- Name: The human-readable name of the bonus (you can put anything you like here). The ID shown next to it is the unique identifier that the module uses to refer to the bonus, which is also used in Active Effects (see below).
- Bonuses: Depending on the type you choose, Build-a-Bonus can add on top of the value or roll, or even several kinds at once. For example, for attack rolls, you can add bonuses on top of the roll itself, but also increase the critical range and the fumble range. You must of course fill out at least one field with valid data. This can be roll data, such as `@abilities.int.mod`, or just integers or dice expressions.
- Description: A human-readable blurb describing the bonus. You can put anything you like here.

### Aura, template, or singular item configuration
You can set the bonus to act as an aura within a set range or within a template created by an item, and define if the aura should apply to allied targets, enemy targets, or all within range or within the template, and whether it applies to the owner or not.

The bonus is applied right before another token actor makes a relevant roll. The module never makes use of token movement to calculate ranges, so the usage of auras and templates is incredibly lightweight.

In the Build-a-Bonus, you can configure a list of effect status ids that prevent the aura from affecting targets and the owner (such as if the source of the aura is dead or unconscious). This blocking feature does not apply to templates, however. A 'status id' is a hidden and unique identifier that any status condition has, and the Keys button in the builder will help you pick it out.

Alternatively, for any bonus created on an item (spell, feature, weapon, etc.), if that bonus does not produce an aura of any kind, you may toggle it in the Build-a-Bonus to only apply to that item in question. This is good for any unique weapons for example that have certain properties that should apply only to themselves.

### Available Filters
- Item Types: The type of item the bonus should apply to. For example if you want to increase the save DC globally but only for equipment type items, not spells. This filter is only available for attack roll, damage roll, and save DC bonuses.
- Saving Throw Types: The type of saving throw the bonus should apply to. Any ability score as well as death saving throws. If you are using the module Concentration Notifier, you can also apply a bonus specifically to saves for maintaining concentration.
- Item Requirements: An available filter to check whether the item should require being equipped or attuned to for the bonus to be active.
- Arbitrary Comparisons: An arbitrary comparison you can use for anything that is not covered in the Build-a-Bonus natively. This supports both roll data and strings. If you enter strings, the inequality will attempt to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor. For example, you can have a bonus apply only when the actor is below half health with `@attributes.hp.value <= @attributes.hp.max`. Unlike other filters, you can add this filter to the builder multiple times.
- Actor Conditions: Filter the bonus to only apply if the actor is affected by a specific status condition. This uses the status id string stored in status conditions, as detailed above.
- Target Conditions: Filter the bonus to only apply if the target (of the client logged in) is affected by a specific status condition. Same details as above.
- Attack Types: Filter the bonus to only apply if the item doing the rolling has an attack roll of that specific kind.
- Damage Types: Filter the bonus to only apply to items that have a damage formula with this kind of damage type.
- Abilities: Filter the bonus to only apply to items that have set the used ability to be one of these types. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons. This is the ability set in the item just below its Action Type in the Details tab.
- Save Ability: Filter the bonus such that it only applies if the DC is set using a specific ability. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'.
- Spell Components: Filter the bonus to only apply if the item is a spell that has any one (or all) of the given components.
- Spell Levels: Filter the bonus to only apply if the item is a spell and is cast at one of the given levels.
- Spell Schools: Filter the bonus to only apply if the item is a spell belonging to one of the given spell schools.
- Base Weapons: Filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'.
- Weapon Properties: Filter the bonus to only apply if the item is a weapon that has at least one from a set of required weapon properties (if any) while having none of the unfit properties (if any).
- Creature Types: Filter the bonus to only apply if you are targeting an enemy belonging to one of the given creature types, such as 'undead', 'fey', or 'humanoid'.
- Custom Script: A blank text field for users to write any JavaScript code they like. The script must be synchronous and return true or false. The available variables declared for the script will vary by the roll type.
- Available Spell Slots: Filter the bonus to apply only if the actor performing the roll has more than the set minimum amount of spell slots available and/or less than the set maximum amount of spell slots available. Not both fields are required.

# API
An API can be accessed at `game.modules.get("babonus").api`. The parameter `object` refers to an Actor, ActiveEffect, or Item. The methods are currently:
- `getId(object, id)` returns the bonus with the given id on the given document.
- `getIds(object)` returns the ids of all bonuses on the document.
- `getName(object, name)` returns the bonus with the given name on the given document. Returns the first one found if multiple have the same name.
- `getNames(object)` returns the names of all bonuses on the document.
- `getType(object, type)` returns all bonuses on the object of the given type (e.g. "attack" or "damage").
- `getCollection(object)` returns a Collection of bonuses on the object.
- `deleteBonus(object, id)` removes the bonus with the given id from the document.
- `copyBonus(original, other, id)` copies a bonus with the given id from one document to another.
- `moveBonus(original, other, id)` copies a bonus with the given id from one document to another, then removes the original bonus.
- `toggleBonus(object, id, state=null)` enables or disables a bonus, or sets it to the given state (true or false).
- `createBabonus(data)` returns a new Babonus document created with the provided data.
- `findEmbeddedDocumentsWithBonuses(object)` returns an object with two arrays containing items and effects on the given document that have a bonus.
- `findTokensInRangeOfAura(object, id)` returns all token documents that are in range of an aura with the given id on the document.
- `openBabonusWorkshop(object)` opens the Build-a-Bonus workshop for the given document.
- `getAllContainingTemplates(tokenDoc)` returns the ids of all templates on the scene that overlap with the Token Document.
- `getMinimumDistanceBetweenTokens(tokenA, tokenB)` returns the minimum distance between two Token placeables, evaluating every grid cell that they occupy.
- `sceneTokensByDisposition(scene)` returns an object of three arrays; the tokens on the scene split into three arrays by disposition. If no scene is provided, the currently viewed scene is used.
- `getOccupiedGridSpaces(tokenDoc)` returns all grid spaces that a token occupies on its scene.
- `getApplicableBonuses(object, type, options)` returns all bonuses that applies to a specific roll with this document.

In addition, if needed, the migration functions are exposed in the `migration` object of the API.

### Can I toggle a bonus on an actor via an effect?
The easiest method if you want to create a niche bonus that should be easily toggled on or off, by far, is to create it on an effect. Bonuses on inactive or unavailable effects are ignored entirely. If the bonus is on the actor, however, just know that the bonuses are more complex in their structure than any usual Active Effect. However, you can modify specific fields of a bonus using effects, and even toggle the bonus on or off.

When you create a bonus, it is given an id. You can either toggle a bonus on or off using the button in the Build-a-Bonus application, or you can create an active effect with this attribute key:

```js
flags.babonus.bonuses.<id>.enabled | Override | <true/false>
```
