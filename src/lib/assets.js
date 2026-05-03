// images.weserv.nl mirrors arbitrary URLs, smooths upscales, and adds CORS *
// so html-to-image can read the pixels for PNG export without canvas tainting.
const WESERV = 'https://images.weserv.nl/';

function viaWeserv(url, params = '') {
  const stripped = url.replace(/^https?:\/\//, '');
  return `${WESERV}?url=${encodeURIComponent(stripped)}&output=webp${params}`;
}

// gametora hosts costume-specific high-res sprites (~50KB PNG with CORS *)
// keyed by both base char id and full costume card_id.
export function characterStandUrl(charId) {
  if (charId == null) return null;
  const id = String(charId);
  const base = id.slice(0, 4);
  return `https://gametora.com/images/umamusume/characters/chara_stand_${base}_${id}.png`;
}

// Small head-focused icon, keyed by 4-digit base character id (default outfit).
// Uses gametora's chr_icon_NNNN.png — ~20KB, CORS-friendly. Good for thumbnails.
export function characterIconUrl(charId) {
  if (charId == null) return null;
  const base = String(charId).slice(0, 4);
  return `https://gametora.com/images/umamusume/characters/icons/chr_icon_${base}.png`;
}

// gametora support card art has CORS *, no proxy needed
export function supportCardArtUrl(supportCardId) {
  if (supportCardId == null) return null;
  return `https://gametora.com/images/umamusume/supports/tex_support_card_${supportCardId}.png`;
}

export function supportCardIconUrl(supportCardId) {
  if (supportCardId == null) return null;
  return `https://gametora.com/images/umamusume/supports/support_card_s_${supportCardId}.png`;
}
