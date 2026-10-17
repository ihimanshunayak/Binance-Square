// Temporary protected Azure OpenAI connectivity check. Remove after validation.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const expected = process.env.AZURE_OPENAI_TEST_TOKEN;
  const supplied = typeof req.query?.token === 'string'
    ? req.query.token
    : new URL(req.url || '/', 'https://vercel.invalid').searchParams.get('token');
  if (!expected || supplied !== expected) return res.status(404).json({ ok: false, error: 'Not found' });

  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  if (!endpoint || !apiKey) return res.status(503).json({ ok: false, error: 'Azure OpenAI env vars missing.' });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are performing a connectivity check. Reply with exactly: AZURE_OK' },
          { role: 'user', content: 'Reply with exactly: AZURE_OK' }
        ],
        max_completion_tokens: 20,
        temperature: 0
      }),
      signal: AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (!response.ok) {
      const msg = data?.error?.message || data?.message || ('HTTP ' + response.status);
      console.error('[azure-test] Request failed: HTTP ' + response.status + ' ' + String(msg).slice(0, 300));
      return res.status(502).json({ ok: false, providerStatus: response.status, error: String(msg).slice(0, 300) });
    }
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({ ok: Boolean(reply), providerStatus: response.status, modelResponded: Boolean(reply), reply: reply || null });
  } catch (error) {
    console.error('[azure-test] Request failed:', error?.message || 'unknown error');
    return res.status(502).json({ ok: false, error: 'Azure request failed before a valid response; check endpoint hostname and deployment.' });
  }
}
