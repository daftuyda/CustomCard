import { forwardRef } from 'react';
import { characterStandUrl, characterIconUrl, supportCardArtUrl } from '../../lib/assets.js';
import {
  formatCompact,
  formatRank,
  limitBreakStars,
  rankColor,
  affinityColor,
  tierColor,
} from '../../lib/format.js';
import { mergeSparks } from '../../lib/sparks.js';
import {
  characterName,
  lookupSupportCard,
  SUPPORT_TYPE_LABELS,
  SUPPORT_TYPE_COLORS,
  RARITY_LABELS,
} from '../../lib/lookups.js';
import './ModernTheme.css';

// Format the trainer id with thin spaces every 3 digits, like a registry number
function formatTrainerId(id) {
  if (!id) return '';
  const s = String(id);
  return s.replace(/(\d{3})(?=\d)/g, '$1 ');
}


// Approximate visual width of a name in em units. CJK glyphs are ~1em wide
// at weight 800; ASCII characters average ~0.55em.
function nameWidth(name) {
  let w = 0;
  for (const ch of name) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x3040 && c <= 0x30ff) ||
      (c >= 0x3400 && c <= 0x9fff) ||
      (c >= 0xff00 && c <= 0xffef) ||
      c >= 0x20000
    ) {
      w += 1.0;
    } else if (c < 0x80) {
      w += 0.55;
    } else {
      w += 0.75;
    }
  }
  return w;
}

// Pick a trainer-name font size so it fits the meta column (~430px wide)
// without truncating. Falls through smaller sizes for longer/CJK-heavy names.
function pickTrainerNameSize(name) {
  const w = nameWidth(name);
  if (w <= 11) return '2.4rem';
  if (w <= 13) return '2rem';
  if (w <= 16) return '1.65rem';
  if (w <= 20) return '1.35rem';
  return '1.15rem';
}

const ModernTheme = forwardRef(function ModernTheme({ profile }, ref) {
  const inh = profile.inheritance;
  const hasInheritance = !!inh;
  const charId = inh?.main_parent_id;
  const leftId = inh?.parent_left_id;
  const rightId = inh?.parent_right_id;
  const charNm = characterName(charId);
  const leftNm = characterName(leftId);
  const rightNm = characterName(rightId);

  const supportId = profile.supportCard?.support_card_id;
  const card = lookupSupportCard(supportId);
  const hasSupport = !!supportId;
  const cardType = card?.type || 'speed';
  const lb = profile.supportCard?.limit_break_count;

  const fanRank = profile.rankings?.alltime?.rank_total_fans ?? profile.rankings?.alltime?.rank;
  const totalFans =
    profile.rankings?.alltime?.total_fans ?? profile.rankings?.monthly?.total_fans;
  const avgDay = profile.rankings?.alltime?.avg_day;

  const blue = mergeSparks(
    inh?.blue_sparks,
    inh?.main_blue_factors,
    inh?.left_blue_factors,
    inh?.right_blue_factors
  );
  const pink = mergeSparks(
    inh?.pink_sparks,
    inh?.main_pink_factors,
    inh?.left_pink_factors,
    inh?.right_pink_factors
  );
  const green = mergeSparks(
    inh?.green_sparks,
    inh?.main_green_factors,
    inh?.left_green_factors,
    inh?.right_green_factors
  );
  const whiteAll = mergeSparks(
    inh?.white_sparks,
    inh?.main_white_factors,
    inh?.left_white_factors,
    inh?.right_white_factors
  );
  const whiteRaces = whiteAll.filter((s) => s.type === 2);
  const whiteSkills = whiteAll.filter((s) => s.type === 3);
  const whiteScenarios = whiteAll.filter((s) => s.type === 4);
  const whiteOther = whiteAll.filter((s) => ![2, 3, 4].includes(s.type));

  return (
    <article
      ref={ref}
      className="uc"
      data-theme="modern"
      style={{ '--type-color': SUPPORT_TYPE_COLORS[cardType] }}
    >
      {/* ============ TOP BAR ============ */}
      <header className="uc__top">
        <div className="uc__support">
          <div className="uc__eyebrow">Support Card</div>
          {hasSupport ? (
            <div className="uc__support-row">
              <div className="uc__support-imgwrap">
                <img
                  src={supportCardArtUrl(supportId)}
                  alt=""
                  className="uc__support-img"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="uc__support-info">
                <div className="uc__support-name">{card?.name ?? `Card #${supportId}`}</div>
                <div className="uc__support-meta">
                  <span className="uc__type-pill">
                    {SUPPORT_TYPE_LABELS[cardType] || cardType}
                  </span>
                  <span className="uc__rarity">{RARITY_LABELS[card?.rarity] || ''}</span>
                  <span className="uc__lb" aria-label={`Limit break ${lb ?? 0} of 4`}>
                    {limitBreakStars(lb)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="uc__empty">Not shared</div>
          )}
        </div>

        <div className="uc__id">
          <div className="uc__id-label">
            <span className="uc__id-rule" aria-hidden="true" />
            Trainer ID
            <span className="uc__id-rule" aria-hidden="true" />
          </div>
          <div className="uc__id-value">{formatTrainerId(profile.trainerId)}</div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className={`uc__hero${!hasInheritance ? ' uc__hero--bare' : ''}`}>
        {hasInheritance ? (
          <div className="uc__hero-img">
            {charId && (
              <img
                src={characterStandUrl(charId)}
                alt=""
                crossOrigin="anonymous"
              />
            )}
          </div>
        ) : null}

        <div className="uc__hero-meta">
          <div className="uc__trainer-block">
            <div className="uc__eyebrow">Trainer</div>
            <h1
              className="uc__trainer-name"
              style={{ fontSize: pickTrainerNameSize(profile.trainerName) }}
            >
              {profile.trainerName}
            </h1>
            {profile.circle?.name && (
              <div className="uc__club">
                <span
                  className="uc__club-tier"
                  style={{ color: tierColor(profile.circle.clubRankName) }}
                >
                  {profile.circle.clubRankName ?? '·'}
                </span>
                <span className="uc__club-name">{profile.circle.name}</span>
              </div>
            )}
          </div>

          {hasInheritance ? (
            <>
              <div className="uc__divider" aria-hidden="true" />

              <div className="uc__char-block">
                <div className="uc__eyebrow">Umamusume</div>
                <div className="uc__char-name">{charNm || 'Unknown'}</div>
              </div>

              <div className="uc__parents-block">
                <div className="uc__parents">
                  <div className="uc__eyebrow">Parents</div>
                  <div className="uc__parents-list">
                    <Parent id={leftId} name={leftNm || '—'} />
                    <span className="uc__parents-sep" aria-hidden="true">×</span>
                    <Parent id={rightId} name={rightNm || '—'} />
                  </div>
                </div>
                <div className="uc__affinity">
                  <div className="uc__eyebrow">Affinity</div>
                  <div
                    className="uc__affinity-value"
                    style={{
                      color:
                        inh?.affinity_score != null
                          ? affinityColor(inh.affinity_score)
                          : 'var(--t-4)',
                    }}
                  >
                    {inh?.affinity_score ?? '—'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="uc__divider" aria-hidden="true" />
              <div className="uc__no-inh">
                <div className="uc__eyebrow">Inheritance</div>
                <div className="uc__no-inh-msg">
                  This trainer hasn’t shared their inheritance data on uma.moe.
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="uc__stats">
        <Stat
          label="Trainer Rank"
          value={formatRank(fanRank)}
          sub="total fans"
          valueColor={rankColor(fanRank)}
        />
        <Stat
          label="Average / Day"
          value={formatCompact(avgDay)}
          sub="fans gained"
        />
        <Stat
          label="Total Fans"
          value={formatCompact(totalFans)}
          sub="career"
        />
      </section>

      {/* ============ SPARK SECTIONS ============ */}
      <section className="uc__sparks">
        <SparkSection color="azure" title="Stat" items={blue} />
        <SparkSection color="rose" title="Aptitude" items={pink} />
        <SparkSection color="emerald" title="Unique Skill" items={green} />
        {whiteSkills.length > 0 && <WhiteSection title="Skill" items={whiteSkills} />}
        {whiteRaces.length > 0 && <WhiteSection title="Race-Win" items={whiteRaces} />}
        {whiteScenarios.length > 0 && <WhiteSection title="Scenario" items={whiteScenarios} />}
        {whiteOther.length > 0 && <WhiteSection title="Other" items={whiteOther} />}
      </section>

    </article>
  );
});

export default ModernTheme;

function Parent({ id, name }) {
  return (
    <span className="uc__parent">
      {id != null && (
        <span className="uc__parent-icon">
          <img
            src={characterStandUrl(id)}
            alt=""
            crossOrigin="anonymous"
          />
        </span>
      )}
      <span className="uc__parent-name">{name}</span>
    </span>
  );
}

function Stat({ label, value, sub, valueColor }) {
  return (
    <div className="uc__stat">
      <div className="uc__eyebrow">{label}</div>
      <div
        className="uc__stat-value"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      <div className="uc__stat-sub">{sub}</div>
    </div>
  );
}

function SparkSection({ color, title, items }) {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + i.total, 0);
  return (
    <div className={`uc__spark uc__spark--${color}`}>
      <div className="uc__spark-head">
        <span className="uc__spark-marker" aria-hidden="true" />
        <span className="uc__spark-title">{title} Sparks</span>
        <span className="uc__spark-stats">
          <span className="uc__spark-total">{total}★</span>
        </span>
      </div>
      <div className="uc__spark-list">
        {items.map((sp) => (
          <SparkChip key={sp.factorId} spark={sp} />
        ))}
      </div>
    </div>
  );
}

function SparkChip({ spark }) {
  const onMain = spark.main > 0;
  // Skip the (+main) badge when the main parent is the *only* contributor —
  // total === main means the value is already implicit.
  const showMainBadge = onMain && spark.main < spark.total;
  return (
    <div
      className={`chip${onMain ? ' chip--main' : ''}`}
      title={`Main:${spark.main}★ · Left:${spark.left}★ · Right:${spark.right}★`}
    >
      <span className="chip__total">{spark.total}<span className="chip__star">★</span></span>
      <span className="chip__name">{spark.name}</span>
      {showMainBadge && <span className="chip__main">+{spark.main}</span>}
    </div>
  );
}

function WhiteSection({ title, items }) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const mainCount = sorted.filter((s) => s.main > 0).length;
  return (
    <div className="uc__spark uc__spark--white">
      <div className="uc__spark-head">
        <span className="uc__spark-marker" aria-hidden="true" />
        <span className="uc__spark-title">{title} Sparks</span>
        <span className="uc__spark-stats">
          <span className="uc__spark-total">{sorted.length}</span>
          <span className="uc__spark-unit">unique</span>
          {mainCount > 0 && (
            <span className="uc__spark-main-count">{mainCount} on main</span>
          )}
        </span>
      </div>
      <div className="uc__white-grid">
        {sorted.map((sp) => {
          const onMain = sp.main > 0;
          const showMainBadge = onMain && sp.main < sp.total;
          return (
            <div
              key={sp.factorId}
              className={`row${onMain ? ' row--main' : ''}`}
              title={`Main:${sp.main}★ · Left:${sp.left}★ · Right:${sp.right}★`}
            >
              <span className="row__total">{sp.total}<span className="row__star">★</span></span>
              <span className="row__name">{sp.name}</span>
              {showMainBadge && <span className="row__main">+{sp.main}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
