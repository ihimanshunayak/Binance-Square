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

    return { configured: true, reachable: true, writeReadTest };
  } catch {
    return { configured: true, reachable: false, writeReadTest: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasBinance = Boolean(process.env.BINANCE_SQUARE_API_KEY);
  const hasMcpSecret = Boolean(process.env.MCP_SECRET_PATH);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);
  const storage = await checkSupabaseStorage();
  const hasSupabase = storage.configured;

  return res.status(200).json({
    ok: true,
    service: 'binance-square',
    mode: 'vercel-functions',
    features: {
      mcpEndpointConfigured: hasMcpSecret,
      textPublishingConfigured: hasBinance,
      imageGenerationConfigured: hasOpenAI,
      newsDraftingConfigured: hasCronSecret && hasOpenAI,
      newsPersistentStorageConfigured: hasSupabase,
      supabaseStorageReachable: storage.reachable,
      supabaseWriteReadTest: storage.writeReadTest,
      liveNewsPublishingReady: hasCronSecret && hasOpenAI && hasBinance && storage.reachable,
      newsAutomationEnabled: String(process.env.NEWS_ENABLED || 'false').toLowerCase() === 'true',
      newsDryRun: String(process.env.NEWS_DRY_RUN || 'true').toLowerCase() !== 'false'
    },
    note: 'Supabase reachability is a read-only query. supabaseWriteReadTest reflects the most recent authenticated write/read/delete round-trip test, if one has run.'
  });
}
