import characters from '../data/characters.json';
import supportCards from '../data/supportCards.json';

export function lookupCharacter(charSubId) {
  if (charSubId == null) return null;
  return characters[String(charSubId)] || null;
}

export function characterName(charSubId) {
  return lookupCharacter(charSubId)?.name || null;
}

export function lookupSupportCard(cardId) {
  if (cardId == null) return null;
  return supportCards[String(cardId)] || null;
}

export const SUPPORT_TYPE_LABELS = {
  speed: 'Speed',
  stamina: 'Stamina',
  power: 'Power',
  guts: 'Guts',
  intelligence: 'Wisdom',
  friend: 'Friend',
};

export const SUPPORT_TYPE_COLORS = {
  speed: '#3a8aff',
  stamina: '#ff5252',
  power: '#ff9b1a',
  guts: '#ff5fa3',
  intelligence: '#23c279',
  friend: '#ff8e29',
};

export const RARITY_LABELS = { 1: 'R', 2: 'SR', 3: 'SSR' };
