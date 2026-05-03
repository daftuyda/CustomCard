// Spark resolver mirroring uma.moe's FactorService:
//   raw value      = string
//   level          = last digit (parsed as int)
//   factor id      = remaining prefix (string key)
//   {name, type}   = lookup in factors.json
//
// Type categories (uma.moe convention):
//   0 = blue   (stat)
//   1 = pink   (aptitude)
//   2 = white  (race-win spark)
//   3 = white  (skill spark)
//   4 = white  (scenario spark)
//   5 = green  (unique skill)

import factors from '../data/factors.json';
import { characterName } from './lookups.js';

const TYPE_TO_COLOR = { 0: 'blue', 1: 'pink', 5: 'green' };

export function resolveSpark(raw) {
  if (raw == null) return null;
  const s = String(raw);
  const level = parseInt(s.slice(-1), 10);
  const factorId = s.slice(0, -1);
  const entry = factors[factorId];
  if (!entry) {
    // Green sparks are character-keyed (e.g. factorId "1026020" = char 102602)
    // and are not enumerated in the factor table.
    if (factorId.length >= 5 && factorId.endsWith('0')) {
      const charSubId = factorId.slice(0, -1);
      const name = characterName(charSubId);
      if (name) return { factorId, level, name, type: 5, color: 'green' };
    }
    return { factorId, level, name: `Factor ${factorId}`, type: -1, color: 'white' };
  }
  return {
    factorId,
    level,
    name: entry.name,
    type: entry.type,
    color: TYPE_TO_COLOR[entry.type] ?? 'white',
  };
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Merge a color's sparks across the inheritance totals + each parent's slot.
// Each entry: {factorId, name, type, color, total, main, left, right}
export function mergeSparks(totalArr, mainVal, leftVal, rightVal) {
  const map = new Map();
  function ensure(factorId, sample) {
    if (!map.has(factorId)) {
      map.set(factorId, {
        factorId,
        name: sample?.name ?? `Factor ${factorId}`,
        type: sample?.type ?? -1,
        color: sample?.color ?? 'white',
        total: 0,
        main: 0,
        left: 0,
        right: 0,
      });
    }
    return map.get(factorId);
  }
  for (const raw of asArray(totalArr)) {
    const sp = resolveSpark(raw);
    if (sp) ensure(sp.factorId, sp).total = sp.level;
  }
  for (const raw of asArray(mainVal)) {
    const sp = resolveSpark(raw);
    if (sp) ensure(sp.factorId, sp).main = sp.level;
  }
  for (const raw of asArray(leftVal)) {
    const sp = resolveSpark(raw);
    if (sp) ensure(sp.factorId, sp).left = sp.level;
  }
  for (const raw of asArray(rightVal)) {
    const sp = resolveSpark(raw);
    if (sp) ensure(sp.factorId, sp).right = sp.level;
  }
  for (const e of map.values()) {
    if (!e.total) e.total = e.main + e.left + e.right;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
