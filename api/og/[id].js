// PNG OG image — built as SVG, rasterized server-side via @resvg/resvg-js.
// Discord embeds need real raster images; SVG OG images render inconsistently
// across platforms. Runs on Node runtime (default) so the napi-rs renderer
// can use its prebuilt Linux x64 binary on Vercel.

import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import { FONTS_B64 } from './fonts.js';
import { SUPPORT_CARDS } from './cards.js';

const SUPPORT_TYPE_LABELS = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power',
  guts: 'Guts', intelligence: 'Wisdom', friend: 'Friend',
};
const SUPPORT_TYPE_COLORS = {
  speed: '#3a8aff', stamina: '#ff5252', power: '#ff9b1a',
  guts: '#ff5fa3', intelligence: '#23c279', friend: '#ff8e29',
};
const RARITY_LABELS = { 1: 'R', 2: 'SR', 3: 'SSR' };

export const config = { runtime: 'nodejs' };

// Fonts are base64-embedded in a sibling JS module so Vercel ships them as
// part of the function bundle (no includeFiles / static-asset config needed).
// Static (non-variable) Inter Bold + ExtraBold are used because resvg-js's
// Linux binary doesn't reliably resolve weight axes on variable Inter.
// Decoded once at module scope; warm invocations reuse the buffers.
const FONT_BUFFERS = [
  Buffer.from(FONTS_B64.interBold, 'base64'),
  Buffer.from(FONTS_B64.interExtraBold, 'base64'),
  Buffer.from(FONTS_B64.notoSansJp, 'base64'),
];

const TIER_COLORS = {
  SS: '#ffd66b', 'S+': '#ff9e3b', S: '#ff9e3b',
  'A+': '#c97cff', A: '#c97cff', 'B+': '#5cd1ff', B: '#5cd1ff',
  'C+': '#7ee887', C: '#7ee887', 'D+': '#8a8f9c', D: '#8a8f9c',
};
const TIER_NAMES = ['', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS'];
const SVG_FONT = 'Inter, Noto Sans JP, sans-serif';

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const PATH_FONTS = {
  bold: opentype.parse(asArrayBuffer(FONT_BUFFERS[0])),
  extraBold: opentype.parse(asArrayBuffer(FONT_BUFFERS[1])),
  jp: opentype.parse(asArrayBuffer(FONT_BUFFERS[2])),
};

// Vercel's Linux resvg runtime can rasterize SVG shapes reliably even when
// <text> font registration fails, so convert all OG labels to paths upfront.
function hasGlyph(font, ch) {
  if (ch === ' ') return true;
  const glyph = font.charToGlyph(ch);
  return glyph && glyph.index !== 0;
}

function fontForChar(ch, weight) {
  const primary = weight >= 800 ? PATH_FONTS.extraBold : PATH_FONTS.bold;
  if (hasGlyph(primary, ch)) return primary;
  if (hasGlyph(PATH_FONTS.jp, ch)) return PATH_FONTS.jp;
  return primary;
}

function glyphAdvance(font, glyph, size) {
  const units = glyph.advanceWidth || font.unitsPerEm * 0.5;
  return (units / font.unitsPerEm) * size;
}

function pathTextWidth(text, { size, weight = 700, letterSpacing = 0 }) {
  let width = 0;
  const chars = Array.from(String(text));
  chars.forEach((ch, index) => {
    const font = fontForChar(ch, weight);
    const glyph = font.charToGlyph(ch);
    width += glyphAdvance(font, glyph, size);
    if (index < chars.length - 1) width += letterSpacing;
  });
  return width;
}

function pathText(text, x, y, { size, weight = 700, fill = '#f4f5f8', letterSpacing = 0 }) {
  let cursor = x;
  const paths = [];
  const chars = Array.from(String(text));

  chars.forEach((ch, index) => {
    const font = fontForChar(ch, weight);
    const glyph = font.charToGlyph(ch);

    if (ch !== ' ' && glyph.index !== 0) {
      const pathData = glyph.getPath(cursor, y, size).toPathData(1);
      if (pathData) paths.push(`<path d="${pathData}"/>`);
    }

    cursor += glyphAdvance(font, glyph, size);
    if (index < chars.length - 1) cursor += letterSpacing;
  });

  return `<g fill="${fill}">${paths.join('')}</g>`;
}

function compact(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function rank(n) {
  if (n == null) return '—';
  return '#' + Number(n).toLocaleString('en-US');
}

function affinityColor(s) {
  if (s == null) return '#828999';
  if (s >= 150) return '#ffd66b';
  if (s >= 100) return '#7ee887';
  if (s >= 50) return '#ffae42';
  return '#ff7a8a';
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'UmaCardOG/1.0' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function loadProfile(id) {
  const [profile, searchData] = await Promise.all([
    fetchJSON(`https://uma.moe/api/v4/user/profile/${id}`),
    // /user/profile doesn't include affinity_score; the search endpoint does.
    // Bump max_follower_num past the 999 default so trainers with 1000+
    // followers still resolve when looked up by ID.
    fetchJSON(`https://uma.moe/api/v3/search?trainer_id=${id}&limit=1&max_follower_num=99999`),
  ]);
  if (!profile?.trainer) return null;

  // Resolve club_rank by the *current* circle_id (from /user/profile). The
  // viewer_id-keyed endpoint returns whatever circle the trainer was last
  // cached against, which can lag behind a recent transfer.
  const currentCircleId = profile.circle?.circle_id;
  const circleData = currentCircleId
    ? await fetchJSON(`https://uma.moe/api/v4/circles?circle_id=${currentCircleId}`)
    : null;

  const inheritance = profile.inheritance ?? null;
  const searchAffinity = searchData?.items?.[0]?.inheritance?.affinity_score;
  if (inheritance && inheritance.affinity_score == null && searchAffinity != null) {
    inheritance.affinity_score = searchAffinity;
  }
  return {
    item: {
      trainer_name: profile.trainer.name,
      inheritance,
      support_card: profile.support_card,
    },
    circle: profile.circle,
    clubRank: circleData?.club_rank ?? null,
    alltime: profile.fan_history?.alltime ?? null,
  };
}

async function fetchImageBase64(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Approximate width of a string in Inter at given font size + weight 800.
// Ascii ~0.55em average, CJK ~1.0em, fullwidth punctuation ~1.0em.
function measureName(s, size) {
  let units = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    // CJK / fullwidth blocks
    if (
      (code >= 0x3040 && code <= 0x30ff) ||      // Hiragana, Katakana
      (code >= 0x3400 && code <= 0x9fff) ||      // CJK Unified
      (code >= 0xff00 && code <= 0xffef) ||      // Fullwidth forms
      code >= 0x20000
    ) {
      units += 1.0;
    } else if (code < 0x80) {
      units += 0.55;
    } else {
      units += 0.7;
    }
  }
  return units * size;
}

function limitBreakStars(lb) {
  if (lb == null) return '';
  const filled = Math.max(0, Math.min(4, lb));
  return '★'.repeat(filled) + '☆'.repeat(4 - filled);
}

function buildSvg({ id, formattedId, trainerName, charImg, circleName, tierName, tierColor,
                    fanRank, totalFans, affinity, blueStars, pinkStars, whiteCount,
                    supportCardImg, supportCardName, supportCardType, supportCardRarity, supportCardLb }) {
  // Auto-fit the trainer name into the right column (~624px wide), trying
  // progressively smaller sizes before truncating.
  const NAME_MAX_W = 624;
  const NAME_SIZES = [108, 96, 84, 72, 62, 54, 46];
  let nameDisplay = trainerName;
  let nameSize = NAME_SIZES[0];
  for (const sz of NAME_SIZES) {
    if (measureName(trainerName, sz) <= NAME_MAX_W) {
      nameSize = sz;
      nameDisplay = trainerName;
      break;
    }
    nameSize = sz;
  }
  // If even the smallest size overflows, truncate with ellipsis.
  while (measureName(nameDisplay, nameSize) > NAME_MAX_W && nameDisplay.length > 4) {
    nameDisplay = nameDisplay.slice(0, -2) + '…';
  }

  // Club pill that lives on the same row as the "Trainer" eyebrow at the
  // top-right of the right column.
  let clubDisplay = circleName.length > 22 ? circleName.slice(0, 21) + '…' : circleName;
  const CLUB_TIER_SIZE = 26;
  const CLUB_NAME_SIZE = 22;
  let tierMeasured = tierName ? pathTextWidth(tierName, { size: CLUB_TIER_SIZE, weight: 800 }) : 0;
  const clubInnerPad = 22;
  const tierGap = tierName ? 14 : 0;
  let clubNameMeasured = pathTextWidth(clubDisplay, { size: CLUB_NAME_SIZE, weight: 700 });
  const CLUB_MAX_W = 460;
  while (
    clubInnerPad + tierMeasured + tierGap + clubNameMeasured + clubInnerPad > CLUB_MAX_W &&
    clubDisplay.length > 4
  ) {
    clubDisplay = clubDisplay.slice(0, -2) + '…';
    clubNameMeasured = pathTextWidth(clubDisplay, { size: CLUB_NAME_SIZE, weight: 700 });
  }
  const clubPillWidth = Math.min(
    CLUB_MAX_W,
    clubInnerPad + tierMeasured + tierGap + clubNameMeasured + clubInnerPad
  );
  const CLUB_PILL_HEIGHT = 48;

  // Trainer ID badge — pick the largest font size that fits inside the
  // character panel with comfortable margins.
  const PANEL_W = 480;
  const BADGE_MARGIN = 24;        // gap between badge edge and panel edge
  const BADGE_INNER_PAD = 28;     // gap between text and badge edge
  const ID_MAX_TEXT_W = PANEL_W - BADGE_MARGIN * 2 - BADGE_INNER_PAD * 2;
  const ID_SIZES = [50, 46, 42, 38, 34, 30];
  let idSize = ID_SIZES[ID_SIZES.length - 1];
  let idTextMeasured = pathTextWidth(formattedId, { size: idSize, weight: 800, letterSpacing: 1 });
  for (const sz of ID_SIZES) {
    const w = pathTextWidth(formattedId, { size: sz, weight: 800, letterSpacing: 1 });
    if (w <= ID_MAX_TEXT_W) {
      idSize = sz;
      idTextMeasured = w;
      break;
    }
    idSize = sz;
    idTextMeasured = w;
  }
  const idLabelMeasured = pathTextWidth('Trainer ID', { size: 17, weight: 700, letterSpacing: 3 });
  const idBadgeWidth = Math.min(
    PANEL_W - BADGE_MARGIN * 2,
    Math.max(idTextMeasured, idLabelMeasured) + BADGE_INNER_PAD * 2
  );
  const idBadgeHeight = 100;
  // Center both lines horizontally inside the badge.
  const idLabelX = (idBadgeWidth - idLabelMeasured) / 2;
  const idTextX = (idBadgeWidth - idTextMeasured) / 2;
  const blueStarsText = String(blueStars);
  const pinkStarsText = String(pinkStars);
  const whiteCountText = String(whiteCount);
  const blueStarsWidth = pathTextWidth(blueStarsText, { size: 42, weight: 800 });
  const pinkStarsWidth = pathTextWidth(pinkStarsText, { size: 42, weight: 800 });
  const whiteCountWidth = pathTextWidth(whiteCountText, { size: 42, weight: 800 });
  const fanRankText = rank(fanRank);
  const totalFansText = compact(totalFans);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${SVG_FONT}">
  <defs>
    <style>
      .root { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
      .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: 4px; fill: #5c6374; text-transform: uppercase; }
      .name { font-weight: 800; letter-spacing: -3px; fill: #f4f5f8; }
      .stat-label { font-size: 13px; font-weight: 700; letter-spacing: 2.2px; fill: #5c6374; text-transform: uppercase; }
      .stat-value { font-size: 36px; font-weight: 800; letter-spacing: -1px; }
      .pill-text { font-size: 22px; font-weight: 600; fill: #b4bac8; }
      .tier { font-size: 24px; font-weight: 800; }
      .id-eyebrow { font-size: 14px; font-weight: 700; letter-spacing: 3px; fill: #828999; text-transform: uppercase; }
      .id-num { font-size: 36px; font-weight: 800; letter-spacing: 1px; fill: #f4f5f8; }
      .spark-num { font-weight: 800; }
      .spark-star { font-size: 18px; font-weight: 800; }
      .spark-label { font-size: 13px; font-weight: 700; letter-spacing: 2.2px; fill: #5c6374; text-transform: uppercase; }
    </style>
    <clipPath id="charClip">
      <rect x="0" y="0" width="480" height="630"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="#11141c"/>
  <rect x="0" y="0" width="480" height="630" fill="#161a24"/>

  ${charImg ? `<g clip-path="url(#charClip)">
    <image href="${escape(charImg)}" x="-30" y="-90" width="540" height="720"
           preserveAspectRatio="xMidYMax slice"/>
  </g>` : ''}

  <line x1="480" y1="0" x2="480" y2="630" stroke="#232838" stroke-width="1"/>

  <g transform="translate(${(PANEL_W - idBadgeWidth) / 2}, ${600 - idBadgeHeight - 10})">
    <rect x="0" y="0" width="${idBadgeWidth}" height="${idBadgeHeight}" rx="16"
          fill="#0a0c11" stroke="#2e3447" stroke-width="1.5"/>
    ${pathText('Trainer ID', idLabelX, 36, { size: 17, weight: 700, fill: '#828999', letterSpacing: 3 })}
    ${pathText(formattedId, idTextX, 82, { size: idSize, weight: 800, fill: '#f4f5f8', letterSpacing: 1 })}
  </g>

  ${pathText('Trainer', 536, 80, { size: 18, weight: 700, fill: '#5c6374', letterSpacing: 4 })}

  ${circleName ? `
  <g transform="translate(${1160 - clubPillWidth}, ${80 - 32})">
    <rect x="0" y="0" width="${clubPillWidth}" height="${CLUB_PILL_HEIGHT}" rx="${CLUB_PILL_HEIGHT / 2}" fill="#161a24" stroke="#232838" stroke-width="1"/>
    ${tierName ? pathText(tierName, clubInnerPad, 34, { size: CLUB_TIER_SIZE, weight: 800, fill: tierColor }) : ''}
    ${pathText(clubDisplay, clubInnerPad + tierMeasured + tierGap, 32, { size: CLUB_NAME_SIZE, weight: 700, fill: '#b4bac8' })}
  </g>
  ` : ''}

  ${pathText(nameDisplay, 536, 80 + 32 + nameSize * 0.85, { size: nameSize, weight: 800, fill: '#f4f5f8', letterSpacing: -3 })}

  ${supportCardName ? `
  <g transform="translate(536, 240)">
    <rect x="0" y="0" width="624" height="104" rx="14" fill="#161a24" stroke="#232838" stroke-width="1"/>
    <!-- Type-color accent, inset so it doesn't poke through the badge's rounded corner -->
    <rect x="0" y="10" width="5" height="84" rx="2.5" fill="${SUPPORT_TYPE_COLORS[supportCardType] || '#828999'}"/>

    ${supportCardImg ? `
    <clipPath id="cardThumb"><rect x="18" y="8" width="64" height="88" rx="6"/></clipPath>
    <rect x="18" y="8" width="64" height="88" rx="6" fill="#0a0c11" stroke="#2e3447" stroke-width="1"/>
    <image href="${escape(supportCardImg)}" x="18" y="8" width="64" height="88"
           preserveAspectRatio="xMidYMid slice" clip-path="url(#cardThumb)"/>
    ` : ''}

    ${pathText('Support Card', supportCardImg ? 96 : 24, 38, { size: 16, weight: 700, fill: '#9099ad', letterSpacing: 2.4 })}
    ${pathText(supportCardName, supportCardImg ? 96 : 24, 76, { size: 30, weight: 800, fill: '#f4f5f8', letterSpacing: -0.5 })}

    ${(() => {
      const typeLabel = SUPPORT_TYPE_LABELS[supportCardType] || supportCardType || '';
      const typeColor = SUPPORT_TYPE_COLORS[supportCardType] || '#828999';
      const rarityLabel = RARITY_LABELS[supportCardRarity] || '';
      const lbText = limitBreakStars(supportCardLb);
      const TYPE_SIZE = 17;
      const RARITY_SIZE = 24;
      const LB_SIZE = 22;
      const typeLabelW = pathTextWidth(typeLabel, { size: TYPE_SIZE, weight: 800, letterSpacing: 1.5 });
      const rarityW = rarityLabel ? pathTextWidth(rarityLabel, { size: RARITY_SIZE, weight: 800 }) : 0;
      const lbW = lbText ? pathTextWidth(lbText, { size: LB_SIZE, weight: 700 }) : 0;
      const pillW = typeLabelW + 28;
      const gap = 16;
      const totalW = pillW + (rarityLabel ? gap + rarityW : 0) + (lbText ? gap + lbW : 0);
      const startX = 624 - 24 - totalW;
      const PILL_H = 32;
      const PILL_Y = (104 - PILL_H) / 2;
      let cursor = startX;
      let svg = '';
      svg += `<rect x="${cursor}" y="${PILL_Y}" width="${pillW}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${typeColor}"/>`;
      svg += pathText(typeLabel, cursor + 14, PILL_Y + 22, { size: TYPE_SIZE, weight: 800, fill: '#0a0c11', letterSpacing: 1.5 });
      cursor += pillW + gap;
      if (rarityLabel) {
        svg += pathText(rarityLabel, cursor, PILL_Y + 24, { size: RARITY_SIZE, weight: 800, fill: '#ffd66b' });
        cursor += rarityW + gap;
      }
      if (lbText) {
        svg += pathText(lbText, cursor, PILL_Y + 24, { size: LB_SIZE, weight: 700, fill: '#ffd66b' });
      }
      return svg;
    })()}
  </g>
  ` : ''}

  <g transform="translate(536, ${supportCardName ? 356 : 300})">
    <rect x="0" y="0" width="624" height="108" rx="14" fill="#161a24" stroke="#232838" stroke-width="1"/>

    <rect x="16" y="22" width="4" height="64" rx="2" fill="#5cd1ff"/>
    ${pathText('Stat', 32, 46, { size: 22, weight: 700, fill: '#9099ad', letterSpacing: 2.4 })}
    ${pathText(blueStarsText, 32, 92, { size: 42, weight: 800, fill: '#f4f5f8' })}
    ${pathText('★', 32 + blueStarsWidth + 10, 92, { size: 36, weight: 800, fill: '#ffd66b' })}

    <line x1="208" y1="18" x2="208" y2="90" stroke="#232838" stroke-width="1"/>

    <rect x="224" y="22" width="4" height="64" rx="2" fill="#ff8ec0"/>
    ${pathText('Aptitude', 240, 46, { size: 22, weight: 700, fill: '#9099ad', letterSpacing: 2.4 })}
    ${pathText(pinkStarsText, 240, 92, { size: 42, weight: 800, fill: '#f4f5f8' })}
    ${pathText('★', 240 + pinkStarsWidth + 10, 92, { size: 36, weight: 800, fill: '#ffd66b' })}

    <line x1="416" y1="18" x2="416" y2="90" stroke="#232838" stroke-width="1"/>

    <rect x="432" y="22" width="4" height="64" rx="2" fill="#f4f5f8"/>
    ${pathText('White Skills', 448, 46, { size: 22, weight: 700, fill: '#9099ad', letterSpacing: 2.4 })}
    ${pathText(whiteCountText, 448, 92, { size: 42, weight: 800, fill: '#f4f5f8' })}
    ${pathText('UNIQUE', 448 + whiteCountWidth + 12, 92, { size: 21, weight: 700, fill: '#5c6374', letterSpacing: 2 })}
  </g>

  ${(() => {
    // Three columns laid out across 624px. Pre-measure each value at 36px to
    // detect overflow, then shrink the value font for that cell only.
    const PANEL_W = 624;
    const cellPad = 24;
    const minColW = 160;
    const cells = [
      { label: 'Trainer Rank', value: fanRankText, color: '#f4f5f8' },
      { label: 'Total Fans', value: totalFansText, color: '#f4f5f8' },
      {
        label: 'Affinity',
        value: affinity != null ? String(affinity) : '—',
        color: affinity != null ? affinityColor(affinity) : '#5c6374',
      },
    ];
    // Compute desired column widths from the wider of label/value at full size.
    const VAL_SIZE = 48;
    const LABEL_SIZE = 20;
    const measuredVals = cells.map((c) => pathTextWidth(c.value, { size: VAL_SIZE, weight: 800, letterSpacing: -1 }));
    const measuredLabels = cells.map((c) => pathTextWidth(c.label, { size: LABEL_SIZE, weight: 700, letterSpacing: 2.4 }));
    const desired = cells.map((_, i) => Math.max(measuredVals[i], measuredLabels[i]) + cellPad * 2);
    const totalDesired = desired.reduce((a, b) => a + b, 0);
    let widths;
    if (totalDesired <= PANEL_W) {
      // Distribute leftover slack evenly so the separators sit in tidy columns.
      const slack = (PANEL_W - totalDesired) / 3;
      widths = desired.map((w) => w + slack);
    } else {
      // Scale down proportionally with a per-column floor.
      const scale = PANEL_W / totalDesired;
      widths = desired.map((w) => Math.max(minColW, w * scale));
      // Fudge: re-normalize so we exactly fill PANEL_W
      const sum = widths.reduce((a, b) => a + b, 0);
      widths = widths.map((w) => (w / sum) * PANEL_W);
    }
    let cursor = 0;
    let cellsSvg = '';
    let dividers = '';
    cells.forEach((c, i) => {
      const colW = widths[i];
      const valW = measuredVals[i];
      // If the value still overflows the cell, shrink its font size for this cell.
      let valSize = VAL_SIZE;
      if (valW + cellPad * 2 > colW) {
        valSize = Math.max(28, Math.floor(VAL_SIZE * (colW - cellPad * 2) / valW));
      }
      cellsSvg += pathText(c.label, cursor + cellPad, 42, { size: LABEL_SIZE, weight: 700, fill: '#9099ad', letterSpacing: 2.4 });
      cellsSvg += pathText(c.value, cursor + cellPad, 100, { size: valSize, weight: 800, fill: c.color, letterSpacing: -1 });
      cursor += colW;
      if (i < cells.length - 1) {
        dividers += `<line x1="${cursor}" y1="22" x2="${cursor}" y2="118" stroke="#232838" stroke-width="1"/>`;
      }
    });
    const panelY = supportCardName ? 476 : 436;
    return `<g transform="translate(536, ${panelY})">
      <rect x="0" y="0" width="${PANEL_W}" height="124" rx="14" fill="#161a24" stroke="#232838" stroke-width="1"/>
      ${dividers}
      ${cellsSvg}
    </g>`;
  })()}
</svg>`;
}

export default async function handler(req, res) {
  const idRaw = String(req.query.id || '');
  const id = idRaw.replace(/\.(png|svg)$/, '');

  if (!/^\d{9,12}$/.test(id)) {
    res.status(400).send('Invalid trainer ID');
    return;
  }

  try {
    const data = await loadProfile(id);
    if (!data) {
      res.status(404).send('Trainer not found');
      return;
    }
    const { item, circle, clubRank, alltime } = data;

    const trainerName = item?.trainer_name || alltime?.trainer_name || `Trainer ${id}`;
    const charId = item?.inheritance?.main_parent_id;
    const charBase = charId ? String(charId).slice(0, 4) : null;
    const charImg = charId
      ? await fetchImageBase64(
          `https://gametora.com/images/umamusume/characters/chara_stand_${charBase}_${charId}.png`
        )
      : null;

    const fanRank = alltime?.rank_total_fans ?? alltime?.rank;
    const totalFans = alltime?.total_fans;
    const affinity = item?.inheritance?.affinity_score;
    const tierName = TIER_NAMES[clubRank] || null;
    const tierColor = TIER_COLORS[tierName] || '#828999';
    const circleName = circle?.name || '';

    // Borrowed support card — name/type/rarity from local lookup, art from gametora.
    const supportCardId = item?.support_card?.support_card_id;
    const supportCardLb = item?.support_card?.limit_break_count;
    const supportCardMeta = supportCardId ? SUPPORT_CARDS[String(supportCardId)] : null;
    const supportCardName = supportCardMeta?.name || (supportCardId ? `Card #${supportCardId}` : null);
    const supportCardType = supportCardMeta?.type || 'speed';
    const supportCardRarity = supportCardMeta?.rarity ?? null;
    const supportCardImg = supportCardId
      ? await fetchImageBase64(
          `https://gametora.com/images/umamusume/supports/tex_support_card_${supportCardId}.png`
        )
      : null;

    const sumStars = (arr) =>
      Array.isArray(arr) ? arr.reduce((s, v) => s + (Number(v) % 10 || 0), 0) : 0;
    const blueStars = sumStars(item?.inheritance?.blue_sparks);
    const pinkStars = sumStars(item?.inheritance?.pink_sparks);
    const whiteCount = item?.inheritance?.white_count ?? 0;

    const formattedId = id.replace(/(\d{3})(?=\d)/g, '$1 ');

    const svg = buildSvg({
      id, formattedId, trainerName, charImg, circleName, tierName, tierColor,
      fanRank, totalFans, affinity, blueStars, pinkStars, whiteCount,
      supportCardImg, supportCardName, supportCardType, supportCardRarity, supportCardLb,
    });

    // Render at 2× the SVG's viewBox (2400×1260) for retina-sharp text and UI.
    // Discord/Twitter/Slack scale down for display; Open Graph spec handles
    // any size up to 5MB and ≥1200×630.
    const resvg = new Resvg(svg, {
      background: '#11141c',
      fitTo: { mode: 'width', value: 2400 },
      logLevel: 'off',
    });
    const png = resvg.render().asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(png.length));
    res.setHeader(
      'Cache-Control',
      'public, max-age=300, s-maxage=900, stale-while-revalidate=86400'
    );
    res.status(200).end(png);
  } catch (err) {
    console.error('OG render error:', err);
    res.status(500).send('Render failed: ' + (err?.message || String(err)));
  }
}
