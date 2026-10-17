import { randomUUID } from 'node:crypto';

const TABLE = 'binance_square_kv';
const STATUS_KEY = '__persistence_test_status__';

function getConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase storage is not configured.');
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = getConfig();
  const response = await fetch(url + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: AbortSignal.timeout(8000)
  });
  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { /* Ignore non-JSON body. */ }
  if (!response.ok) throw new Error('Supabase request failed with HTTP ' + response.status);
  return data;
}

async function saveStatus(status) {
  await request(TABLE, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key: STATUS_KEY,
      value: JSON.stringify({ ...status, checkedAt: new Date().toISOString() }),
      updated_at: new Date().toISOString()
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const key = '__persistence_test__:' + randomUUID();
  const value = 'roundtrip:' + randomUUID();
  let writeSucceeded = false;
  let readSucceeded = false;
  let cleanupSucceeded = false;

  try {
    await request(TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
    });
    writeSucceeded = true;

    const rows = await request(TABLE + '?key=eq.' + encodeURIComponent(key) + '&select=key,value&limit=1', {
      method: 'GET'
    });
    readSucceeded = Array.isArray(rows) && rows.length === 1 && rows[0].key === key && rows[0].value === value;

    if (!readSucceeded) throw new Error('The value written could not be read back exactly.');

    await request(TABLE + '?key=eq.' + encodeURIComponent(key), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    });
    cleanupSucceeded = true;

    const result = { ok: true, writeSucceeded, readSucceeded, cleanupSucceeded };
    await saveStatus(result);
    console.log('[storage-test] Supabase write/read/delete round-trip succeeded.');
    return res.status(200).json({
      ...result,
      message: 'Supabase write/read/delete round-trip succeeded. No Binance post was attempted.'
    });
  } catch (error) {
    if (writeSucceeded && !cleanupSucceeded) {
      try {
        await request(TABLE + '?key=eq.' + encodeURIComponent(key), {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
        cleanupSucceeded = true;
      } catch { /* Best-effort cleanup; do not expose database details. */ }
    }

    const result = { ok: false, writeSucceeded, readSucceeded, cleanupSucceeded };
    try { await saveStatus(result); } catch { /* Status may be unavailable if Supabase is the failing component. */ }
    console.error('[storage-test] Supabase persistence test failed:', error?.message || 'unknown error');
    return res.status(500).json({
      ...result,
      error: 'Supabase persistence test failed. Check Vercel runtime logs for the sanitized error.'
    });
  }
}
