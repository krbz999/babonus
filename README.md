<h1 style="text-align: center; font-size: 60px; border: none; font-weight: bold; font-style: italic;">Build-a-Bonus</h1>

<p style="text-align: center; font-style: italic;">2022 Package Jam winner of the 'Most Polished' category and runner-up for 'Best Package'</p>

<p>A module for the Foundry <code>dnd5e</code> system. After installing this module, you can find a 'Build-a-Bonus' application in any actor's, items, or effect's header. This gives you the ability to apply a bonus to any attack roll, damage roll, saving throw DC, saving throw, ability check, or hit die roll, for bonuses that should apply only under specific circumstances. If a bonus is embedded in an item or effect, they transfer with the item/effect if placed on another actor.</p>

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

<p style="text-align: center"><img src="https://i.imgur.com/zbp4CQ6.png" style="border: none"></p>

<h1 style="font-weight: bold;">How to Use</h1>
<p>Open any actor's sheet, any item sheet, or any effect config, then click the otter icon in the header. Choose the type of bonus you want to create, then fill out the name, description, and the bonus. Then start narrowing down when and how the bonus should apply, using the available filters to the right.<p>
<p>Once the bonus is created, you can configure it further on the main view of the application on the right.</p>
<p>If you need additional hints, hover over any of the labels to get tooltips. Not all filters are available for each type of bonus. Below is an example using the artificer's <em>Alchemical Savant</em> feature.</p>

<p style="text-align: center"><img src="https://i.imgur.com/bWlbqUQ.png" style="border: none"></p>

<p>Once you are done creating the bonus, save it, and your actor should now have their bonus apply when they perform the relevant roll, given that they match the filters of the bonus.</p>

<h1 style="font-weight: bold;">Bonus Creation and Configuration</h1>
<p>This is the full array of configurations, filters, and choices you can make in the Build-a-Bonus. For any fields that support roll data (such as bonuses or comparison fields detailed below), you can use the roll data of the target as well as your own; use roll data as you normally would, and for targets simply prefix with <code>@target</code>.</p>
<p>In addition, when a bonus is 'transferred' either via an effect being copied through a template aura or regular aura, the roll data used will be source's roll data, if any. This means that your paladin player can have their Aura of Protection set up using <code>@abilties.cha.mod</code> and all allies within the aura will receive a bonus equal to the paladin's Charisma modifier, not their own Charisma modifier.</p>
<p>One thing to keep in mind is that bonuses use the source's roll data, while the filters use the recipient's roll data.</p>

<h2 style="font-weight: bold;">Required Fields</h2>
<p><strong><em>Name.</em></strong> The human-readable name of the bonus (you can put anything you like here). The ID shown next to it is the unique identifier that the module uses to refer to the bonus, which is also used in several API methods (see below).</p>
<p><strong><em>Description.</em></strong> A blurb of your choosing describing the bonus. This text is enriched and supports roll data.</p>

<h2 style="font-weight: bold;">Bonuses and Modifiers</h2>
<p>Depending on the type you choose, Build-a-Bonus can add on top of the value or roll, or even several kinds at once. For example, for attack rolls, you can add bonuses on top of the roll itself, but also increase the critical range and the fumble range. This can be roll data and scale values, such as <code>@abilities.int.mod</code>, or just integers or dice expressions.</p>
<p>For damage rolls and hit dice rolls, you can also affect die modifiers. The supported modifiers are minimum and maximum values, rerolling, and explosive dice.</p>

<h2 style="font-weight: bold;">Aura and Template Configuration</h2>
<p>You can set the bonus to act as an aura within a set range or within a template created by an item, and define if the aura should apply to allied targets, enemy targets, or all within range or within the template, and whether it applies to the owner or not.</p>
<p>The bonus is applied when another token actor makes a relevant roll. The module never makes use of token movement to calculate ranges, so the usage of auras and templates is incredibly lightweight.</p>
<p>You can configure a list of effect statuses that prevent the aura from affecting targets and the owner (such as if the source of the aura is dead or unconscious). The Keys button in the builder will help you pick out statuses from those that exist on the token HUD. The field itself is not validated; if you are able to give an effect a status of your own choosing, that is respected as well; simply write the status in the field.</p>
<p>Lastly, you can configure a non-template aura to require direct line of sight from the source token to the rolling token's actor, or to require an unobstructed path of movement.</p>

<h3><strong>Item-Specific Bonuses</strong></h3>
<p>For any bonus created on an item (spell, feature, weapon, etc.), if that bonus does not produce a valid aura of any kind, you may toggle it in the Build-a-Bonus to only apply to that item in question. This is good for any unique weapons for example that have certain properties that should apply only to themselves.</p>

<p style="text-align: center"><img src="https://i.imgur.com/CgHESmY.png" style="border: none"></p>

<h3 style="font-weight: bold;">Optional Bonuses and Consumption</h3>
<p>If the bonus additively affects an attack roll, damage roll, saving throw, or ability check (adding a bonus on top), the bonus can be toggled to be optional. Other types of bonuses will apply regardless. The actor will then have the choice when adding the bonus, which is shown in the roll configuration dialog when making the roll.</p>
<p>If the bonus is optional as described above, the bonus can also be configured to consume limited uses, item quantity, spell slots, hit points, currencies, or the active effect on which it is created. You can configure the minimum required consumption, as well as the maximum if the bonus should scale.</p>
<p>For example, if you create an item with 10 limited uses, a bonus of "1d6", configure that the bonus is optional, and consumes between 2 and 6 uses when opted into, the actor making the roll can easily add between 2d6 and 6d6 in the roll configuration dialog, and the expended uses are automatically subtracted. This works similarly for spell slots, instead using 1 slot and scaling with spell level. A bonus consuming its effect cannot scale.</p>

<p style="text-align: center"><img src="https://i.imgur.com/XcEOZU7.png" style="border: none"></p>
<p style="text-align: center"><img src="https://i.imgur.com/eJsfogz.png" style="border: none"></p>

<h1 style="font-weight: bold;">Available Filters</h1>
<p>These are the available filters that narrow down if the bonus should apply when making a roll.</p>
<p><strong><em>Abilities.</em></strong> The ability score used for the roll. This respects items set to use defaults, such as spells using the spellcasting ability, or finesse weapons using either Strength or Dexterity.</p>
<p><strong><em>Actor Conditions.</em></strong> Filter the bonus to only apply if the actor is affected by any of the included status conditions while having none of the excluded status conditions. This uses the statuses stored in status conditions, as detailed above.</p>
<p><strong><em>Arbitrary Comparisons.</em></strong> An array of arbitrary comparisons you can use for anything that is not covered in the Build-a-Bonus natively. This supports numbers, roll data, and strings. If you enter strings, you can use the inequalities to match substrings. It will otherwise attempt to determine numeric values after replacing roll data with the roll data of the item and actor performing the roll. For example, you can have a bonus apply only when the actor is below full health with <code>@attributes.hp.value <= @attributes.hp.max</code>. Unlike other filters, you can add this filter to the builder multiple times.</p>
<p><strong><em>Attack Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has an attack roll of that specific kind.</p>
<p><strong><em>Available Spell Slots.</em></strong> Filter the bonus to apply only if the actor performing the roll has more than the set minimum amount of spell slots available and/or less than the set maximum amount of spell slots available. Not both fields are required.</p>
<p><strong><em>Base Armors.</em></strong> Filter the bonus to only apply if the actor is wearing a specific type of armor or a shield.</p>
<p><strong><em>Base Weapons.</em></strong> Filter the bonus to only apply if the item is a weapon with one of these base weapon types, such as 'battleaxe' or 'blowgun'.</p>
<p><strong><em>Actor Creature Types.</em></strong> Filter the bonus to only apply if you are belonging to one of the included creature types, such as 'undead', 'fey', or 'humanoid', while not belonging to any of the excluded creature types.</p>
<p><strong><em>Target Creature Types.</em></strong> Filter the bonus to only apply if you are targeting an enemy belonging to one of the included creature types, such as 'undead', 'fey', or 'humanoid', while not targeting any of the excluded creature types.</p>
<p><strong><em>Custom Scripts.</em></strong> A blank text field for users to write any JavaScript code they like. The script must be fully synchronous and return true or false. The available variables declared for the script will vary by the roll type, but <code>actor</code>, <code>item</code>, <code>token</code>, and <code>bonus</code> are always provided if possible, as well as an object, <code>details</code>, used for the iteration of parsing the validity of the bonuses. For those uncomfortable with having all clients execute these scripts, a setting is available for the module which will completely ignore the scripts and simply immediately return true.</p>
<p><strong><em>Damage Types.</em></strong> Filter the bonus to only apply if the item used to perform the roll has a damage formula with any of the included damage types while having none of the excluded damage types.</p>
<p><strong><em>Health Percentages.</em></strong> A percentage value and whether the actor must have at least or at most this amount of remaining hit points for the bonus to apply.</p>
<p><strong><em>Item Types.</em></strong> The type of item the bonus should apply to. For example if you want to increase the save DC globally but only for equipment type items, not spells.</p>
<p><strong><em>Proficiency Levels.</em></strong> The level of proficiency that the actor must have with the roll made. This is available for ability checks, saving throws, and attack rolls.</p>
<p><strong><em>Save Ability.</em></strong> Filter the bonus such that it only applies if the DC is set using a specific ability. This respects spellcasting abilities in case the item has its save DC set using 'Spellcasting'.</p>
<p><strong><em>Saving Throw Types.</em></strong> The type of saving throw the bonus should apply to (any ability score as well as death saving throws). If you are using the module Concentration Notifier, you can also apply a bonus specifically to saves for maintaining concentration.</p>
<p><strong><em>Skills.</em></strong> The type of skill the roll must be for the bonus to apply. For example Athletics, Nature, or Survival.</p>
<p><strong><em>Spell Components.</em></strong> Filter the bonus to only apply if the item is a spell that has any one (or all) of the given components.</p>
<p><strong><em>Spell Levels.</em></strong> Filter the bonus to only apply if the item is a spell and is or was cast at one of the given levels.</p>
<p><strong><em>Spell Preparation Modes.</em></strong> Filter the bonus to only apply if the item is a spell and is set as one of a selected few preparation modes such as 'pact magic' or 'innate'.</p>
<p><strong><em>Spell Schools.</em></strong> Filter the bonus to only apply if the item is a spell belonging to one of the given spell schools.</p>
<p><strong><em>Target Conditions.</em></strong> Filter the bonus to only apply if the target (of the client performing the roll) is affected by any of the included status conditions while having none of the excluded status conditions.</p>
<p><strong><em>Token Sizes.</em></strong> Filter the bonus to only apply if the target (of the client performing the roll) is a token of a certain size or greater (or smaller), and optionally clamped using the roller's token's size.</p>
<p><strong><em>Tool Types.</em></strong> The type of tool the item must be for the bonus to apply. For example Herbalism Kit, Thieves' Tools, or Cobbler's Tools.</p>
<p><strong><em>Weapon Properties.</em></strong> Filter the bonus to only apply if the item is a weapon that has at least one of the included weapon properties while having none of the excluded properties.</p>

<h1 style="font-weight: bold;">API</h1>
<p>An API can be accessed at <code>game.modules.get("babonus").api</code> or through the global namespace <code>babonus</code>. The parameter <code>object</code> below refers to an Actor, ActiveEffect, Item, or MeasuredTemplateDocument. The methods are currently:</p>
<ul>
<li><code>getId(object, id)</code> returns the bonus with the given id on the given document.</li>
<li><code>getIds(object)</code> returns the ids of all bonuses on the document.</li>
<li><code>getName(object, name)</code> returns the bonus with the given name on the given document. Returns the first one found if multiple have the same name.</li>
<li><code>getNames(object)</code> returns the names of all bonuses on the document.</li>
<li><code>getType(object, type)</code> returns all bonuses on the object of the given type (e.g. "attack", "damage", "save", "throw", "test", "hitdie").</li>
<li><code>getCollection(object)</code> returns a Collection of bonuses on the object.</li>
<li><code>fromUuid(uuid)</code> returns a bonus on a given document. The uuid is the uuid of the parent document appended with <code>.Babonus.< id ></code>.</li>
<li><code>createBabonus(data)</code> returns a new Babonus document created with the provided data. This does not create the bonus on the document, only in memory.</li>
<li><code>embedBabonus(object, bonus)</code> embeds the data of the given babonus into the given actor, item, or effect.</li>
<li><code>copyBonus(original, other, id)</code> copies a bonus with the given id from one document to another. Note that a bonus can also be dragged and dropped via the ui.</li>
<li><code>deleteBonus(object, id)</code> removes the bonus with the given id from the document.</li>
<li><code>moveBonus(original, other, id)</code> copies a bonus with the given id from one document to another, then removes the original bonus.</li>
<li><code>toggleBonus(object, id, state=null)</code> enables or disables a bonus, or sets it to the given state (true or false).</li>
<li><code>findEmbeddedDocumentsWithBonuses(object)</code> returns an object with two arrays containing items and effects on the given document that have a bonus.</li>
<li><code>findTokensInRangeOfAura(object, id)</code> returns all token documents that are in range of an aura with the given id on the document.</li>
<li><code>findTokensInRangeOfToken(token, radiusFt)</code> returns an array of token placeables that are within the given range of the given token placeable.</li>
<li><code>openBabonusWorkshop(object)</code> opens the Build-a-Bonus workshop for the given document.</li>
<li><code>getAllContainingTemplates(tokenDoc)</code> returns the ids of all templates on the scene that overlap with the token document.</li>
<li><code>getMinimumDistanceBetweenTokens(tokenA, tokenB)</code> returns the minimum distance between two token placeables, evaluating every grid cell that they occupy.</li>
<li><code>sceneTokensByDisposition(scene)</code> returns an object of four arrays; the tokens on the scene split into four arrays by disposition (friendly, neutral, hostile, and none). If no scene is provided, the currently viewed scene is used.</li>
<li><code>getOccupiedGridSpaces(tokenDoc)</code> returns all grid spaces that a token occupies on its scene.</li>
<li>Within the API's <code>filters</code> object, you can find all the filtering functions used by the module internally. They are too numerous to list here.</li>
</ul>

<h1 style="font-weight: bold;">Hooks</h1>
<p>A single hook, <code>babonus.applyOptionalBonus</code> is called when applying an optional bonus; after updates or deletions are performed, but before the bonus is applied to the roll. It provides the babonus, the rolling item or actor, the item, actor, or effect that was updated or deleted, and an object with the bonus that will be applied. The bonus to be applied can be modified. Explicitly returning <code>false</code> will prevent the bonus from being applied entirely.</p>

<h1>Compatibility</h1>
<p>You should not expect this module to work with other modules that overhaul or destroy core roll behaviour, particularly WIRE, RSR, and MIDI. These modules are unsupported, and any compatiblity is nothing but a happy accident.</p>
