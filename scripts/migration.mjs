// move itemTypes from required to filter.
// move throwTypes from required to filter.
// move itemRequirements from required to filter.
// convert arbitraryComparison into an array of [{one,operator,other}].
// convert 'identifier' to 'id' and create new ids (16 characters, regular foundry ids).
// convert 'label' to 'name'.
// convert 'bonuses.<type>.<identifier>.{...values}' to 'bonuses.<id>.{...values}'.
// convert 'values' to 'bonuses'.
// store the fact that migration has happened... somewhere. In a setting?




/**
 * TARGETS OF MIGRATION:
 * - world items
 * - world items' effects
 * - world actors
 * - world actor's items
 * - world actor's items' effects
 * - scenes' templates
 * - scenes' token actors
 * - scenes' token actors' items
 * - scenes' token actors' items' effects
 * - compendium actors
 * - compendium actors' items
 * - compendium actors' items' effects
 */


