export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasBinance = Boolean(process.env.BINANCE_SQUARE_API_KEY);
  const hasMcpSecret = Boolean(process.env.MCP_SECRET_PATH);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);
  const hasSupabase = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

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
      liveNewsPublishingReady: hasCronSecret && hasOpenAI && hasBinance && hasSupabase,
      newsAutomationEnabled: String(process.env.NEWS_ENABLED || 'false').toLowerCase() === 'true',
      newsDryRun: String(process.env.NEWS_DRY_RUN || 'true').toLowerCase() !== 'false'
    },
    note: 'This health check reports configuration only. It does not make paid API calls or verify external credentials.'
  });
}
