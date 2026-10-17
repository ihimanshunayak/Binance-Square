import runNews from './cron-news.js';

// Temporary one-time live test endpoint. Remove immediately after the controlled run.
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

  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ ok: false, error: 'Cron authorization is not configured.' });
  }

  const originalImageMode = process.env.NEWS_IMAGE_MODE;
  const originalPostsPerRun = process.env.NEWS_POSTS_PER_RUN;
  process.env.NEWS_IMAGE_MODE = 'none'; // Text-only test avoids image generation cost.
  process.env.NEWS_POSTS_PER_RUN = '1';

  const authenticatedReq = {
    ...req,
    headers: {
      ...req.headers,
      authorization: 'Bearer ' + process.env.CRON_SECRET
    }
  };

  try {
    return await runNews(authenticatedReq, res);
  } finally {
    if (originalImageMode === undefined) delete process.env.NEWS_IMAGE_MODE;
    else process.env.NEWS_IMAGE_MODE = originalImageMode;
    if (originalPostsPerRun === undefined) delete process.env.NEWS_POSTS_PER_RUN;
    else process.env.NEWS_POSTS_PER_RUN = originalPostsPerRun;
  }
}
