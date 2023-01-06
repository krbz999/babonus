<h1 style="text-align: center; font-size: 60px; border: none; font-weight: bold; font-style: italic;">Build-a-Bonus</h1>

<p style="text-align: center; font-style: italic;">2022 Package Jam winner of the 'Most Polished' category and runner-up for 'Best Package'</p>

<p>A module for the Foundry <code>dnd5e</code> system. After installing this module, you can find a 'Build-a-Bonus' application in any actor's Special Traits, in the header of any item, or in the header of any Active Effect. This gives you the ability to apply a bonus to any attack roll, damage roll, saving throw DC, saving throw, or hit die roll, for bonuses that should apply only under specific circumstances. If a bonus is embedded in an item or effect, they transfer with the item/effect if placed on another actor.</p>

<p style="text-align: center"><img src="https://i.imgur.com/PEtyFfQ.png" style="border: none"></p>

<p>Any bonuses you create will automatically be calculated when you perform an attack roll, damage roll, when you use an item that has a saving throw, when you perform a saving throw yourself, or when you roll a hit die. For example:</p>
<ul>
<li>Implement the alchemist artificer's feature to add their intelligence modifier (<code>@abilities.int.mod</code>) to the damage rolls of all Spell-type items, and have Build-a-Bonus filter the bonus so it only applies to spells, only if it deals acid, fire, necrotic, poison, or healing, and only if it has a material (M) component.</li>
<li>Give your wizard player a bonus to the saving throw DC with just Divination spells, and equal to the level of the spell.</li>
<li>Give your magical pugilist a feature akin to Brutal Critical and have it apply only to melee spell attacks.</li>
<li>Give your paladin an aura that grants each enemy within 10 feet a &minus;2 to melee attack rolls.</li>
<li>Give your rogue player a magic item that creates a 15-foot radius template, inside which everyone gets a damage roll bonus equal to their sneak attack dice.</li>
</ul>
<p>The Build-a-Bonus has countless options for how or what to apply and when. Scroll down to the bottom for the full list.</p>

<p style="text-align: center"><img src="https://i.imgur.com/Ygf0fPE.png" style="border: none"></p>

<h1 style="font-weight: bold;">How to Use</h1>
<p>Open any actor's sheet, then find the Special Traits (on the main tab of the actor sheet if using the core dnd5e sheet) and find the Build-a-Bonus workshop. For an item or effect, click the otter icon in the header. Choose the type of bonus you want to create (attack roll, damage roll, save dc, saving throws, or hit die rolls), then fill out the name, description, and the bonus. Then start narrowing down when and how the bonus should apply, using the available filters and configurations that you can pick and choose from on the left and right.</p>
<p>If you need additional hints, hover over any of the labels to get tooltips. Not all filters are available for each type of bonus. Below is an example using the artificer's <em>Alchemical Savant</em> feature.</p>

<p style="text-align: center"><img src="https://i.imgur.com/OnLz50Y.png" style="border: none"></p>

<p>Once you are done creating the bonus, save it, and your actor should now have their bonus apply when they perform the relevant roll, given that they match the filters of the bonus.</p>

<h1 style="font-weight: bold;">Bonus Creation and Configuration</h1>
<p>This is the full array of configurations, filters, and choices you can make in the Build-a-Bonus. For any fields that support roll data (such as bonuses or comparison fields detailed below), you can use the roll data of the target as well as your own; use roll data as you normally would, and for targets simply prefix with <code>@target</code>.</p>

<h2 style="font-weight: bold;">Required Fields</h2>
<p><strong><em>Name.</em></strong> The human-readable name of the bonus (you can put anything you like here). The ID shown next to it is the unique identifier that the module uses to refer to the bonus, which is also used in several API methods (see below).</p>
<p><strong><em>Description.</em></strong> A blurb of your choosing describing the bonus.</p>
<p><strong><em>Bonuses.</em></strong> Depending on the type you choose, Build-a-Bonus can add on top of the value or roll, or even several kinds at once. For example, for attack rolls, you can add bonuses on top of the roll itself, but also increase the critical range and the fumble range. This can be roll data, such as <code>@abilities.int.mod</code>, or just integers or dice expressions.</p>

<h2 style="font-weight: bold;">Aura and Template Configuration</h2>
<p>You can set the bonus to act as an aura within a set range or within a template created by an item, and define if the aura should apply to allied targets, enemy targets, or all within range or within the template, and whether it applies to the owner or not.</p>
<p>The bonus is applied when another token actor makes a relevant roll. The module never makes use of token movement to calculate ranges, so the usage of auras and templates is incredibly lightweight.</p>
<p>In the Build-a-Bonus, you can configure a list of effect status ids that prevent the aura from affecting targets and the owner (such as if the source of the aura is dead or unconscious). This blocking feature does not apply to templates, however. A 'status id' is a hidden and unique identifier that any status condition has, and the Keys button in the builder will help you pick it out. The field itself is not validated; if you are able to give an effect a status id of your own choosing, that is respected as well.</p>

<h3><strong>Item-Specific Bonuses</strong></h3>
<p>Alternatively, for any bonus created on an item (spell, feature, weapon, etc.), if that bonus does not produce a valid aura of any kind, you may toggle it in the Build-a-Bonus to only apply to that item in question. This is good for any unique weapons for example that have certain properties that should apply only to themselves.</p>

<h3 style="font-weight: bold;">Optional Bonuses and Consumption</h3>
<p>If the bonus additively affects an attack roll, damage roll, or saving throw (adding a bonus on top), the bonus can be toggled to be optional. Other types of bonuses will reply regardless. The actor will then have the choice when adding the bonus, which is shown in the roll configuration dialog when making an attack roll, damage roll, or saving throw.</p>
<p>If the bonus is not an aura of any kind, is optional as described above, and if the item on which the bonus is embedded has either limited uses or a quantity (such as a quiver of arrows), the bonus can also be configured to consume these when choosing to add the optional bonus. You can configure the minimum required consumption, as well as the maximum if the bonus should scale.</p>
<p>For example, if you create an item with 10 limited uses, a bonus of "+1d6", and configure that the bonus is optional, consumes between 2 and 6 uses when opted into, the actor making the roll can easily add between 2d6 and 6d6 in the roll configuration dialog, and the expended uses are automatically subtracted.</p>

<h1 style="font-weight: bold;">Available Filters</h1>
<p>These are the available filters that narrow down if the bonus should apply when making a roll.</p>
<p><strong><em>Item Types.</em></strong> The type of item the bonus should apply to. For example if you want to increase the save DC globally but only for equipment type items, not spells. This filter is only available for attack roll, damage roll, and save DC bonuses.</p>
<p><strong><em>Saving Throw Types.</em></strong> The type of saving throw the bonus should apply to. Any ability score as well as death saving throws. If you are using the module Concentration Notifier, you can also apply a bonus specifically to saves for maintaining concentration.</p>
<p><strong><em>Item Requirements.</em></strong> An available filter to check whether the item should require being equipped or attuned to for the bonus to be active. This filter is only available when creating a bonus on an item that can be either of these things.</p>
<p><strong><em>Arbitrary Comparisons.</em></strong> An arbitrary comparison you can use for anything that is not covered in the Build-a-Bonus natively. This supports numbers, roll data, and strings. If you enter strings, you can use the inequalities to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor. For example, you can have a bonus apply only when the actor is below half health with <code>@attributes.hp.value <= @attributes.hp.max</code>. Unlike other filters, you can add this filter to the builder multiple times.</p>
<p><strong><em>Actor Conditions.</em></strong> Filter the bonus to only apply if the actor is affected by a specific status condition. This uses the status id string stored in status conditions, as detailed above.</p>
<p><strong><em>Target Conditions.</em></strong> Filter the bonus to only apply if the target (of the client performing the roll) is affected by a specific status condition. Same details as above.</p>
<p><strong><em>Attack Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has an attack roll of that specific kind.</p>
<p><strong><em>Damage Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has a damage formula with this kind of damage type.</p>
<p><strong><em>Abilities.</em></strong> Filter the bonus to only apply to items that have set the used ability to be one of these types. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons. This is the ability set in the item just below its Action Type in the Details tab.</p>
<p><strong><em>Save Ability.</em></strong> Filter the bonus such that it only applies if the DC is set using a specific ability. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'.</p>
<p><strong><em>Spell Components.</em></strong> Filter the bonus to only apply if the item is a spell that has any one (or all) of the given components.</p>
<p><strong><em>Spell Levels.</em></strong> Filter the bonus to only apply if the item is a spell and is or was cast at one of the given levels.</p>
<p><strong><em>Spell Schools.</em></strong> Filter the bonus to only apply if the item is a spell belonging to one of the given spell schools.</p>
<p><strong><em>Base Weapons.</em></strong> Filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'.</p>
<p><strong><em>Weapon Properties.</em></strong> Filter the bonus to only apply if the item is a weapon that has at least one from a set of required weapon properties (if any) while having none of the unfit properties (if any).</p>
<p><strong><em>Creature Types.</em></strong> Filter the bonus to only apply if you are targeting an enemy belonging to one of the given creature types, such as 'undead', 'fey', or 'humanoid'.</p>
<p><strong><em>Custom Scripts.</em></strong> A blank text field for users to write any JavaScript code they like. The script must be synchronous and return true or false. The available variables declared for the script will vary by the roll type, but <code>actor</code>, <code>item</code>, and <code>token</code> are always provided if possible.</p>
<p><strong><em>Available Spell Slots.</em></strong> Filter the bonus to apply only if the actor performing the roll has more than the set minimum amount of spell slots available and/or less than the set maximum amount of spell slots available. Not both fields are required.</p>

<h1 style="font-weight: bold;">API</h1>
<p>An API can be accessed at <code>game.modules.get("babonus").api</code> or through the global namespace <code>babonus</code>. The parameter <code>object</code> below refers to an Actor, ActiveEffect, Item, or MeasuredTemplateDocument. The methods are currently:</p>
<ul>
<li><code>getId(object, id)</code> returns the bonus with the given id on the given document.</li>
<li><code>getIds(object)</code> returns the ids of all bonuses on the document.</li>
<li><code>getName(object, name)</code> returns the bonus with the given name on the given document. Returns the first one found if multiple have the same name.</li>
<li><code>getNames(object)</code> returns the names of all bonuses on the document.</li>
<li><code>getType(object, type)</code> returns all bonuses on the object of the given type (e.g. "attack" or "damage").</li>
<li><code>getCollection(object)</code> returns a Collection of bonuses on the object.</li>
<li><code>fromUuid(uuid)</code> returns a bonus on a given document. The uuid is the uuid of the parent document appended with <code>.Babonus.<babonus-id></code>.</li>
<li><code>deleteBonus(object, id)</code> removes the bonus with the given id from the document.</li>
<li><code>copyBonus(original, other, id)</code> copies a bonus with the given id from one document to another.</li>
<li><code>moveBonus(original, other, id)</code> copies a bonus with the given id from one document to another, then removes the original bonus.</li>
<li><code>toggleBonus(object, id, state=null)</code> enables or disables a bonus, or sets it to the given state (true or false).</li>
<li><code>createBabonus(data)</code> returns a new Babonus document created with the provided data.</li>
<li><code>findEmbeddedDocumentsWithBonuses(object)</code> returns an object with two arrays containing items and effects on the given document that have a bonus.</li>
<li><code>findTokensInRangeOfAura(object, id)</code> returns all token documents that are in range of an aura with the given id on the document.</li>
<li><code>openBabonusWorkshop(object)</code> opens the Build-a-Bonus workshop for the given document.</li>
<li><code>getAllContainingTemplates(tokenDoc)</code> returns the ids of all templates on the scene that overlap with the Token Document.</li>
<li><code>getMinimumDistanceBetweenTokens(tokenA, tokenB)</code> returns the minimum distance between two Token placeables, evaluating every grid cell that they occupy.</li>
<li><code>sceneTokensByDisposition(scene)</code> returns an object of three arrays; the tokens on the scene split into three arrays by disposition. If no scene is provided, the currently viewed scene is used.</li>
<li><code>getOccupiedGridSpaces(tokenDoc)</code> returns all grid spaces that a token occupies on its scene.</li>
<li><code>getApplicableBonuses(object, type, options)</code> returns all bonuses that applies to a specific roll with this document.</li>
</ul>
<p>In addition, if needed, the migration functions used to migrate bonuses in your world to Babonus v10.2.0 exposed in the <code>migration</code> object of the API.
