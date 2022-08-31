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
  <img src="https://user-images.githubusercontent.com/50169243/186772217-e06465d0-a832-46b0-9196-0f3ad3d78e58.png">
</p>

Once you are done creating the bonus, save it and your actor should now have their bonus apply when they use an item with a saving throw attached, or when they roll attack or damage with an item, given that they match the filters of the bonus.

## Toggling a Bonus via Active Effects
The bonuses are more complex in their structure than the usual ActiveEffects. However, you can modify specific fields of a bonus using effects, and even toggle the bonus on or off. When you create a bonus, you are prompted to give it an identifier (the label is for human eyes only). You can either toggle a bonus on or off using the button in the Build-a-Bonus application, or you can create an active effect with this attribute key: `flags.babonus.bonuses.<attack/damage/save>.<identifier>.enabled | Override | <true or false>`.
