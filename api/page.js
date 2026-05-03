// Node serverless function — handles requests rewritten from /:id(\d{9,12}).
// Returns the SPA shell with per-trainer Open Graph tags injected so Discord,
// Twitter/X, iMessage, Slack, etc. unfurl share links as image previews.

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const OG_IMAGE_VERSION = '20260502-pathtext';

async function fetchTrainerName(id) {
  try {
    const r = await fetch(
      `https://uma.moe/api/v4/user/profile/${id}`,
      { headers: { 'User-Agent': 'UmaCardBot/1.0' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.trainer?.name ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^\d{9,12}$/.test(id)) {
    res.status(400).send('Invalid trainer ID');
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  // Fetch the static SPA shell + the trainer name in parallel.
  const [shellResp, trainerName] = await Promise.all([
    fetch(`${origin}/`),
    fetchTrainerName(id),
  ]);

  const title = trainerName
    ? `${trainerName} · UmaCard`
    : `UmaCard · Trainer ${id}`;
  const description = trainerName
    ? `${trainerName}'s Umamusume profile card.`
    : 'Umamusume profile card.';

  const ogImage = `${origin}/api/og/${id}.png?v=${OG_IMAGE_VERSION}`;
  const pageUrl = `${origin}/${id}`;

  const tags = `
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />

    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${escape(pageUrl)}" />
    <meta property="og:image" content="${escape(ogImage)}" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="1260" />
    <meta property="og:site_name" content="UmaCard" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <meta name="twitter:image" content="${escape(ogImage)}" />
  `.trim();

  let html = await shellResp.text();
  html = html.replace(/<title>[^<]*<\/title>/i, '');
  html = html.replace(
    /\s*<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"\s+content="[^"]*"\s*\/?>/gi,
    ''
  );
  html = html.replace('</head>', `${tags}\n</head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
  );
  res.status(200).send(html);
}
