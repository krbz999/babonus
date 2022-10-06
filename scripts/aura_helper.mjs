import { getAllActorBonuses } from "./helpers.mjs";

/**
 * Gets all auras that apply to the actor on this scene.
 */
export function getAllAurasOnScene(actor, hookType) {
  const tokenDoc = actor.token ?? actor.getActiveTokens(false, true)[0];
  if (!tokenDoc) return [];

  const { HOSTILE, FRIENDLY } = CONST.TOKEN_DISPOSITIONS;
  const friends = tokenDoc.parent.tokens.filter(t => {
    if (t === tokenDoc) return false;
    return t.disposition === tokenDoc.disposition;
  });
  const enemies = tokenDoc.parent.tokens.filter(t => {
    if (t === tokenDoc) return false;
    if (tokenDoc.disposition === FRIENDLY) {
      return t.disposition === HOSTILE;
    }
    if (tokenDoc.disposition === HOSTILE) {
      return t.disposition === FRIENDLY;
    }
    return false;
  });

  if (!friends.length && !enemies.length) return [];

  const friendBonuses = friends.reduce((acc, friend) => {
    if (!friend.actor) return acc;
    const auras = getAllActorBonuses(friend.actor, hookType);
    const valid = auras.filter(([id, val]) => {
      if (val.aura?.disposition !== "FRIENDLY") return false;
      return auraWithinRange(tokenDoc, friend, val.aura);
    });
    return acc.concat(valid);
  }, []);
  const enemyBonuses = enemies.reduce((acc, enemy) => {
    if (!enemy.actor) return acc;
    const auras = getAllActorBonuses(enemy.actor, hookType);
    const valid = auras.filter(([id, val]) => {
      if (val.aura?.disposition !== "HOSTILE") return false;
      return auraWithinRange(tokenDoc, enemy, val.aura);
    });
    return acc.concat(valid);
  }, []);

  return friendBonuses.concat(enemyBonuses);
}

function auraWithinRange(me, you, { range }) {
  if (!range) return false;
  const options = { gridSpaces: true };
  return canvas.grid.measureDistance(me.object, you.object, options) <= range;
}
