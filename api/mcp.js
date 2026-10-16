/**
 * MCP endpoint placeholder for Vercel.
 * The Streamable HTTP transport from the original standalone server must be
 * adapted to Vercel's request/response lifecycle before this route can be used.
 * It intentionally fails closed rather than accepting unauthenticated publish
 * requests or pretending that MCP tools are available.
 */
export default function handler(req, res) {
  const secret = process.env.MCP_SECRET_PATH;
  const supplied = req.query?.secret;
  if (!secret || supplied !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(501).json({
    error: 'MCP transport not yet configured for Vercel. The original always-on Streamable HTTP server needs an adapter and an end-to-end test before use.'
  });
}
