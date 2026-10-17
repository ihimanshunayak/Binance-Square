import { postText } from '../lib/binance.js';

// Temporary protected test endpoint; remove after the single publishing check.
const POST_TEXT = "🚀 Testing My AI-Powered Development Workflow!\n\nToday I'm testing a real production workflow connecting Vercel, Supabase, and the Binance Square publishing API.\n\n✅ Vercel serverless deployment\n✅ Supabase persistent storage\n✅ API integration and error handling\n\nBuilding software isn't just about writing code — it's about proving that every component works reliably in production.\n\nWhat's your biggest challenge when deploying AI-powered applications?\n\n#AI #WebDevelopment #Vercel #Supabase #BuildInPublic";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expected = process.env.NEWS_ONE_TIME_TEST_TOKEN;
  const supplied = typeof req.query?.token === 'string'
    ? req.query.token
    : new URL(req.url || '/', 'https://vercel.invalid').searchParams.get('token');
  if (!expected || supplied !== expected) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  try {
    const response = await postText(POST_TEXT);
    if (response?.code !== '000000') {
      console.error('[manual-publish-test] Binance did not confirm success:', JSON.stringify(response).slice(0, 1000));
      return res.status(502).json({ ok: false, error: 'Binance did not confirm success.', response });
    }
    return res.status(200).json({
      ok: true,
      via: 'Vercel production function and BINANCE_SQUARE_API_KEY',
      postId: response?.data?.id || null,
      shareLink: response?.data?.shareLink || null,
      message: 'Binance API accepted the approved test post.'
    });
  } catch (error) {
    console.error('[manual-publish-test] Publishing failed:', error?.message || 'unknown error');
    return res.status(500).json({ ok: false, error: 'Publishing failed. Check Vercel runtime logs.' });
  }
}
