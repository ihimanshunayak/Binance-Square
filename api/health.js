export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  return res.status(200).json({
    ok: true,
    service: 'binance-square',
    mode: 'vercel-functions',
    features: {
      mcpPosting: Boolean(process.env.MCP_SECRET_PATH && process.env.BINANCE_SQUARE_API_KEY),
      imageGeneration: Boolean(process.env.OPENAI_API_KEY),
      newsAutomationConfigured: Boolean(process.env.CRON_SECRET),
      newsAutomationEnabled: String(process.env.NEWS_ENABLED || 'false').toLowerCase() === 'true'
    },
    note: 'Health check confirms runtime configuration only; it does not test Binance/OpenAI credentials.'
  });
}
