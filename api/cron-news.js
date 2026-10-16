/**
 * Vercel Cron endpoint scaffold.
 * Configure CRON_SECRET in Vercel and use Authorization: Bearer <CRON_SECRET>.
 * This route deliberately does not publish until the news job is ported to
 * persistent storage and the Binance/OpenAI API paths are tested.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization || '';
  if (!expected || provided !== `Bearer ${expected}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  return res.status(501).json({
    ok: false,
    mode: 'scaffold-only',
    error: 'News publishing is not enabled in this Vercel scaffold. Add persistent deduplication storage and verified Binance/OpenAI handlers before enabling live posts.'
  });
}
