async function checkSupabaseStorage() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { configured: false, reachable: false, writeReadTest: null };

  try {
    const response = await fetch(
      url + '/rest/v1/binance_square_kv?select=key&limit=1',
      {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!response.ok) return { configured: true, reachable: false, writeReadTest: null };

    let writeReadTest = null;
    try {
      const statusResponse = await fetch(
        url + '/rest/v1/binance_square_kv?key=eq.__persistence_test_status__&select=value&limit=1',
        {
          method: 'GET',
          headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
          },
          signal: AbortSignal.timeout(5000)
        }
      );
      if (statusResponse.ok) {
        const rows = await statusResponse.json();
        const value = rows?.[0]?.value;
        if (typeof value === 'string') {
          try { writeReadTest = JSON.parse(value); } catch { /* Ignore malformed status values. */ }
        }
      }
    } catch { /* A status lookup failure must not mark the main storage query unreachable. */ }

    let lastNewsRun = null;
    try {
      const runResponse = await fetch(
        url + '/rest/v1/binance_square_kv?key=eq.news-last-run&select=value&limit=1',
        {
          method: 'GET',
          headers: { apikey: key, Authorization: 'Bearer ' + key },
          signal: AbortSignal.timeout(4000)
        }
      );
      if (runResponse.ok) {
        const rows = await runResponse.json();
        const value = rows?.[0]?.value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            lastNewsRun = {
              status: parsed.status || null,
              startedAt: parsed.startedAt || null,
              completedAt: parsed.completedAt || null,
              updatedAt: parsed.updatedAt || null,
              dryRun: parsed.dryRun ?? null,
              attempted: Number.isFinite(parsed.attempted) ? parsed.attempted : 0,
              published: Number.isFinite(parsed.published) ? parsed.published : 0,
              failed: Number.isFinite(parsed.failed) ? parsed.failed : 0,
              runStage: parsed.runStage || null,
              outcome: parsed.outcome || null,
              lastPost: parsed.lastPost ? {
                title: parsed.lastPost.title || null,
                postId: parsed.lastPost.postId || null,
                link: parsed.lastPost.link || null
              } : null,
              errorCode: parsed.errorCode || null
            };
          } catch { /* Ignore a malformed persisted run status. */ }
        }
      }
    } catch { /* Run-status storage must not make the health endpoint fail. */ }

    return { configured: true, reachable: true, writeReadTest, lastNewsRun };
  } catch {
    return { configured: true, reachable: false, writeReadTest: null, lastNewsRun: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAzureOpenAI = Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);
  const hasBinance = Boolean(process.env.BINANCE_SQUARE_API_KEY);
  const hasMcpSecret = Boolean(process.env.MCP_SECRET_PATH);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);
  const storage = await checkSupabaseStorage();
  const hasSupabase = storage.configured;
  const lastNewsRun = storage.lastNewsRun || null;
  const liveNewsPublishingConfigured = hasCronSecret && hasAzureOpenAI && hasBinance && storage.reachable;
  const lastRunAt = Date.parse(lastNewsRun?.completedAt || lastNewsRun?.updatedAt || '');
  const lastRunAgeMs = Date.now() - lastRunAt;
  const verifiedRecentLivePost = Boolean(
    lastNewsRun &&
    lastNewsRun.status === 'success' &&
    lastNewsRun.dryRun === false &&
    Number(lastNewsRun.published) > 0 &&
    (lastNewsRun.lastPost?.postId || lastNewsRun.lastPost?.link) &&
    Number.isFinite(lastRunAt) &&
    lastRunAgeMs >= 0 &&
    lastRunAgeMs <= 48 * 60 * 60 * 1000
  );

  return res.status(200).json({
    ok: true,
    service: 'binance-square',
    mode: 'vercel-functions',
    features: {
      mcpEndpointConfigured: hasMcpSecret,
      textPublishingConfigured: hasBinance,
      imageGenerationConfigured: hasOpenAI,
      azureOpenAIConfigured: hasAzureOpenAI,
      newsDraftingConfigured: hasCronSecret && hasAzureOpenAI,
      newsPersistentStorageConfigured: hasSupabase,
      supabaseStorageReachable: storage.reachable,
      supabaseWriteReadTest: storage.writeReadTest,
      lastNewsRun: storage.lastNewsRun || null,
      liveNewsPublishingConfigured,
      liveNewsPublishingReady: liveNewsPublishingConfigured && verifiedRecentLivePost,
      newsAutomationEnabled: String(process.env.NEWS_ENABLED || 'false').toLowerCase() === 'true',
      newsDryRun: String(process.env.NEWS_DRY_RUN || 'true').toLowerCase() !== 'false'
    },
    note: 'Supabase reachability is a read-only query. supabaseWriteReadTest reflects the most recent authenticated write/read/delete round-trip test, if one has run.'
  });
}
