# Build-a-Bonus

After installing this module, you can find a 'Build-a-Bonus' application in any actor's Special Traits. This gives you the ability to apply a bonus to any attack roll, damage roll, or saving throw DC, under specific circumstances. You can also find this in the header of items and active effects, for bonuses that should be more temporary or transferrable.

<p align="center">
  <img src="https://user-images.githubusercontent.com/50169243/186771931-0aa81f95-7258-4f03-b418-98a66ea45ea9.png">
</p>

For example:
- you can implement the alchemist artificer's feature that adds their intelligence modifier (`@abilities.int.mod`) on top of any spells that deal specific types of damage, but only if the spells have a material component.
- you can increase the save DC of all divination spells on an actor.
- you can give an actor brutal critical, but only for spell attacks, or give them a global bonus to critical damage equal to their wizard level.

Options are open to you.

## How to Use
Open any actor's sheet, then find the Special Traits (on the main tab of the actor sheet if using the core `dnd5e` sheet). In here, you find a link to the Build-a-Bonus application. Fill out the required fields, then start narrowing down what the bonuses should apply to, and when they should apply, using the available filters. If you need hints, hover over the labels of the required fields, or see the detailed description in the 'Keys', which also help you fill out the forms. On item sheets or effect configs, look at the header to find the Build-a-Bonus application.

<p align="center">
  <img src="https://i.imgur.com/PvnTRRH.png">
</p>

Once you are done creating the bonus, save it and your actor should now have their bonus apply when they use an item with a saving throw attached, or when they roll attack or damage with an item, given that they match the filters of the bonus.

## Toggling a Bonus via Active Effects
The bonuses are more complex in their structure than the usual ActiveEffects. However, you can modify specific fields of a bonus using effects, and even toggle the bonus on or off. When you create a bonus, you are prompted to give it an identifier (the label is for human eyes only). You can either toggle a bonus on or off using the button in the Build-a-Bonus application, or you can create an active effect with this attribute key: `flags.babonus.bonuses.<attack/damage/save>.<identifier>.enabled | Override | <true or false>`.

## The Full Choice List
This is the full array of filters and choices you can make in the Build-a-Bonus.

Required fields:
- Identifiers (label and identifier): the human-readable name of the bonus (you can put anything you like here), and the unique identifier the module uses to refer to the bonus, which is also used in Active Effects.
- Targets: what kind of bonus you are making. Either Attack Rolls, Damage Rolls, or Save DC.
- Bonus: the bonus to add on top of the target. This can be dice rolls (for attack and damage rolls), but Save DC only supports numbers, though using roll data is supported in either case. For damage rolls there is also critical bonuses; dice and damage for additional dice to add on top of critical hits (e.g., increasing the number of weapon dice) and for regular additional damage on top. This supports all attack types, not just weapons.
- Description: a human-readable blurb descriping the bonus. You can put anything you like here.
- Item Types: the type of item the bonus should apply to. E.g., if you want to increase the save DC globally but only for equipment type items, not spells.
- Requirements: two checks that show up in the Build-a-Bonus for items only, to filter whether the item should apply its bonus to the actor by requiring attunement or being equipped.

Filters:
- Damage Types: to filter the bonus to only apply to items that have a damage formula with this kind of damage type.
- Abilities: to filter the bonus to only apply to items that have set the used ability to be one of these types. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons.
- Comparison: an arbitrary comparison you can use for anything that is not covered in the Build-a-Bonus natively. This supports both roll data and strings. If you enter strings, the inequality will attempt to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor.
- Status Effects: to filter the bonus to only apply if the actor is affected by a specific status condition. This uses the `flags.core.statusId` string stored in most status conditions. As such, you can technically add all you want here, and the field is not filtered against valid values.
- Attack Types: to filter the bonus to only apply to attack rolls of a certain kind. This entry only shows up if the Target is set to Attack Rolls.
- Save Ability: to filter the bonus to save DC such that it only applies if the DC is set using a specific ability score. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'.
- Components: to filter the bonus to only apply if the item is a spell that has any one (or all) of the given components.
- Spell Levels: to filter the bonus to only apply if the item is a spell and is cast at one of the given levels.
- Spell Schools: to filter the bonus to only apply if the item is a spell belonging to one of the given spell schools.
- Weapons: to filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'.
- Properties: to filter the bonus to only apply if the item is a weapon that has at least one of the required weapon properties (if any) while having none of the unfit properties (if any).