// Server-side proxy for uma.moe's /api/v3/search.
// uma.moe returns this endpoint without CORS for arbitrary origins, so the
// browser can't call it directly. We do the call server-side and forward.

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^\d{9,12}$/.test(id)) {
    res.status(400).json({ error: 'invalid trainer id' });
    return;
  }
  try {
    // max_follower_num default is 999 (friend-request eligible); raise it so
    // trainers with 1000+ followers still resolve when looked up by ID.
    const r = await fetch(
      `https://uma.moe/api/v3/search?trainer_id=${id}&limit=1&max_follower_num=99999`,
      { headers: { 'User-Agent': 'UmaCardProxy/1.0' } }
    );
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
    );
    res.status(r.status).send(text);
  } catch (err) {
    res.status(502).json({ error: 'upstream fetch failed', message: String(err?.message || err) });
  }
}
