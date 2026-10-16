/**
 * Vercel MCP endpoint placeholder.
 * This route deliberately fails closed: the original Streamable HTTP MCP
 * transport hasn't been ported/tested for Vercel's request/response lifecycle.
 * Do not configure this URL as a working ChatGPT MCP connector yet.
 */
export default function handler(req, res) {
  const secret = process.env.MCP_SECRET_PATH;
  const supplied = req.query?.secret;
  if (!secret || supplied !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(501).json({
    error: 'MCP transport not configured. Deploying this scaffold does not enable Binance publishing.'
  });
}
