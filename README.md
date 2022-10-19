# Build-a-Bonus

After installing this module, you can find a 'Build-a-Bonus' application in any actor's Special Traits, in the header of any item, or in the header of any Active Effect. This gives you the ability to apply a bonus to any attack roll, damage roll, saving throw DC, saving throw, or hit die roll, for bonuses that should apply only under specific circumstances. If a bonus is embedded in an item or effect, they transfer with the item/effect if placed on another actor.

<p align="center">
  <img src="https://i.imgur.com/NgjVEHD.png">
</p>

Any bonuses you create will automatically be calculated when you perform an attack roll, damage roll, or when you use an item that has a saving throw. For example:
- Implement the alchemist artificer's feature to add their intelligence modifier (`@abilities.int.mod`) to the damage rolls of all Spell-type items, and have Build-a-Bonus filter the bonus so it only applies to spells, only if it deals acid, fire, necrotic, poison, or healing, and only if it has a material (M) component.
- Give your wizard player a +5 bonus to the saving throw DC with just Divination spells. Magic items that give a global +1 are dull and boring.
- Give your magical pugilist a feature akin to Brutal Critical and have it apply only to melee spell attacks.
- Give your paladin an aura that grants each enemy within 10 feet a -2 to melee attack rolls.

The Build-a-Bonus has countless options for how or what to apply and when. Scroll to the bottom for the full list.

## How to Use
Open any actor's sheet, then find the Special Traits (on the main tab of the actor sheet if using the core dnd5e sheet) and find the Build-a-Bonus workshop, or click the icon in the header of an item or active effect. Fill out the required fields, then start narrowing down what the bonuses should apply to, and when they should apply, using the available filters. If you need hints, hover over the labels of the required fields, or see the detailed description in the 'Keys', which also help you fill out the forms.

Not all fields will be immediately visible, as some depend on selected filters or item types. Below is an example of a fully filled out bonus to spell damage.

<p align="center">
  <img src="https://i.imgur.com/5xUWQUu.png">
</p>

Once you are done creating the bonus, save it, and your actor should now have their bonus apply when they use an item with a saving throw attached, or when they roll attack or damage with an item, given that they match the filters of the bonus.

## Can I toggle a bonus on an actor via an effect?
The easiest method if you want to create a niche bonus that should be easily toggled on or off, by far, is to create it on an effect. Bonuses on inactive or unavailable effects are ignored entirely. If the bonus is on the actor, however, just know that the bonuses are more complex in their structure than a usual Active Effect. However, you can modify specific fields of a bonus using effects, and even toggle the bonus on or off.

When you create a bonus, you are prompted to give it an identifier (the label is for human eyes only). You can either toggle a bonus on or off using the button in the Build-a-Bonus application, or you can create an active effect with this attribute key:

```js
flags.babonus.bonuses.<attack/damage/save/throw/hitdie>.<identifier>.enabled | Override | <true/false>
```

## The Full Choice List
This is the full array of filters and choices you can make in the Build-a-Bonus.

Required fields:
- Identifiers (label and identifier): the human-readable name of the bonus (you can put anything you like here), and the unique identifier the module uses to refer to the bonus, which is also used in Active Effects.
- Targets: what kind of bonus you are making. Either Attack Rolls, Damage Rolls, or Save DC.
- Bonus: The bonus to add on top of the targeted type. There are many different options here depending on what you are hoping to achieve. All types respect roll data values, however not all types accept dice rolls, such as critical range or save DCs.
- Description: a human-readable blurb descriping the bonus. You can put anything you like here.
- Item Types: the type of item the bonus should apply to. E.g., if you want to increase the save DC globally but only for equipment type items, not spells. Only present for 'Attack Rolls', 'Damage Rolls', and 'Save DC' bonuses.
- Throw Types: The type of saving throw the bonus should apply to. Any ability score as well as death saving throws. Only present for 'Saving Throw'. If you are using the module Concentration Notifier, you can also apply a bonus to specifically saves for maintaining concentration.
- Requirements: two checks that show up in the Build-a-Bonus for items only, to filter whether the item should apply its bonus to the actor by requiring attunement or being equipped.

Any fields that support roll data (such as bonuses above or Comparison fields detailed below), you can use the roll data of the target as well; use roll data as you normally would, simply prefixed with `@target`.

Additionally, you can set the bonus to act as an aura within a set range, and define if the aura should apply to allied targets, enemy targets, or all within range, and whether it applies to the owner or not. The bonus is applied whenever another token actor makes a relevant roll (acting as if they had the bonus in the first place, for all intents and purposes). In the Build-a-Bonus, you can configure a list of effect status ids that prevent the aura from affecting targets and the owner (such as if the source of the aura is dead or unconscious).

Filters:
- Comparison: An arbitrary comparison you can use for anything that is not covered in the Build-a-Bonus natively. This supports both roll data and strings. If you enter strings, the inequality will attempt to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor.
- Actor Conditions: to filter the bonus to only apply if the actor is affected by a specific status condition. This uses the `flags.core.statusId` string stored in most status conditions. As such, you can technically add all you want here, and the field is not filtered against valid values.
- Target Conditions: to filter the bonus to only apply if the target (of the client logged in) is affected by a specific status condition. Same details as above.
- Attack Types: to filter the bonus to only apply to attack rolls of a certain kind. This entry only shows up if the Target is set to 'Attack Rolls' or 'Damage Rolls'.
- Damage Types: to filter the bonus to only apply to items that have a damage formula with this kind of damage type. This only shows up for 'Attack Rolls', 'Damage Rolls' and 'Save DC'.
- Abilities: to filter the bonus to only apply to items that have set the used ability to be one of these types. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons. This only shows up for 'Attack Rolls', 'Damage Rolls' and 'Save DC'.
- Save Ability: to filter the bonus to save DC such that it only applies if the DC is set using a specific ability score. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'. This only shows up for 'Attack Rolls', 'Damage Rolls' and 'Save DC'.
- Components: to filter the bonus to only apply if the item is a spell that has any one (or all) of the given components. This only shows up if 'spell' is included in Item Types above.
- Spell Levels: to filter the bonus to only apply if the item is a spell and is cast at one of the given levels. This only shows up if 'spell' is included in Item Types above.
- Spell Schools: to filter the bonus to only apply if the item is a spell belonging to one of the given spell schools. This only shows up if 'spell' is included in Item Types above.
- Weapons: to filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'. This only shows up if 'weapon' is included in Item Types above.
- Properties: to filter the bonus to only apply if the item is a weapon that has at least one of the required weapon properties (if any) while having none of the unfit properties (if any). This only shows up if 'weapon' is included in Item Types above.

# API
An API can be accessed at `game.modules.get("babonus").api`. The methods are currently:
- `getBonusIds(object)` returns the ids of all bonuses on the document (actor, item, effect).
- `findBonus(object, id)` returns a 3-dimensional array with the bonus type, identifier, and the attributes of a bonus with the given id on the document.
- `deleteBonus(object, id)` deletes the bonus with the given id on the document.
- `copyBonus(original, other, id)` copies a bonus with the given id from one document to another.
- `moveBonus(original, other, id)` copies a bonus with the given id from one document to another, then deletes the original bonus.
- `toggleBonus(object, id, state)` enables or disabled a bonus, or sets it to state (true or false).
- `findEmbeddedDocumentsWithBonused(actor)` returns an object with two arrays containing items and effects on the given actor that have a bonus.
- `changeBonusId(object, oldId, newId)` changes the identifier of the bonus with the given id on the document to the new id.
- `findTokensInRangeOfAura(object, id)` returns all token documents that are in range of an aura with the given id on the document.
- `openBabonusWorkshop(object)` opens the Build-a-Bonus workshop for the given document.
