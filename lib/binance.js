import OpenAI from 'openai';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const V1 = 'https://www.binance.com/bapi/composite/v1/public/pgc/openApi';
const V2 = 'https://www.binance.com/bapi/composite/v2/public/pgc/openApi';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function headers() {
  const key = process.env.BINANCE_SQUARE_API_KEY;
  if (!key) throw new Error('BINANCE_SQUARE_API_KEY is not configured in Vercel.');
  return {
    'Content-Type': 'application/json',
    clienttype: 'binanceSkill',
    'X-Square-OpenAPI-Key': key
  };
}

export async function binancePost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { httpStatus: response.status, raw: raw.slice(0, 1500) };
  }
  if (!response.ok) {
    throw new Error('Binance API returned HTTP ' + response.status + ': ' + JSON.stringify(parsed).slice(0, 1000));
  }
  return parsed;
}

export function postText(postTextValue) {
  return binancePost(V1 + '/content/add', { bodyTextOnly: postTextValue });
}

function isPublicIp(address) {
  const family = isIP(address);
  if (family === 4) {
    const p = address.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const a = p[0], b = p[1], c = p[2];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0 && c === 0 || b === 0 && c === 2)) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      if (isIP(mapped) === 4) return isPublicIp(mapped);
    }
    const first = parseInt(normalized.split(':')[0] || '0', 16);
    if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
    if (normalized.startsWith('2001:db8:')) return false;
    return true;
  }
  return false;
}

async function assertPublicHttpsUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Image URL is invalid.');
  }
  if (url.protocol !== 'https:') throw new Error('Image URL must use HTTPS.');
  if (url.username || url.password) throw new Error('Credentials in image URLs are not allowed.');
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private or local image hosts are not allowed.');
  }
  const records = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !isPublicIp(record.address))) {
    throw new Error('Image host must resolve only to public IP addresses.');
  }
  return url;
}

async function readImageResponse(response) {
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mime)) throw new Error('Image must be JPEG, PNG, WebP or GIF.');
  const advertised = Number(response.headers.get('content-length') || 0);
  if (advertised > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 8 MB limit.');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image response has no body.');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('Image exceeds the 8 MB limit.');
      }
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  return { buf: Buffer.concat(chunks, total), mime };
}

async function getImageBytes({ image_url, image_prompt, openai }) {
  if (image_url) {
    const url = await assertPublicHttpsUrl(image_url.trim());
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BinanceSquareBot/1.1' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Image download failed: HTTP ' + response.status);
    return readImageResponse(response);
  }

  if (!openai) throw new Error('OPENAI_API_KEY is required to generate an image.');
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const output = await openai.images.generate({
    model,
    prompt: image_prompt,
    size: '1024x1024',
    quality: 'medium'
  });
  const base64 = output.data?.[0]?.b64_json;
  if (!base64) throw new Error('OpenAI returned no image bytes.');
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw new Error('Generated image is empty or exceeds the 8 MB limit.');
  return { buf, mime: 'image/png' };
}

function imageNameFromMime(mime) {
  if (mime === 'image/jpeg') return 'post.jpg';
  if (mime === 'image/webp') return 'post.webp';
  if (mime === 'image/gif') return 'post.gif';
  return 'post.png';
}

export async function postWithImage({ post_text, image_prompt, image_url, openai }) {
  const image = await getImageBytes({ image_url, image_prompt, openai });
  const imageName = imageNameFromMime(image.mime);

  const presign = await binancePost(V2 + '/image/presignedUrl', { imageName });
  const uploadUrl = presign?.data?.presignedUrl;
  const fileTicket = presign?.data?.fileTicket;
  if (!uploadUrl || !fileTicket) {
    throw new Error('Binance did not return an image upload URL and ticket: ' + JSON.stringify(presign).slice(0, 1000));
  }

  const uploaded = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': image.mime },
    body: image.buf,
    signal: AbortSignal.timeout(20000)
  });
  if (!uploaded.ok) throw new Error('Image upload failed: HTTP ' + uploaded.status);

  let finalImageUrl = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await binancePost(V2 + '/image/imageStatus', { fileTicket });
    const state = status?.data?.status;
    if (state === 1) {
      finalImageUrl = status.data.imageUrl;
      break;
    }
    if (state === 2) throw new Error('Binance image processing failed: ' + (status?.data?.failedReason || 'unknown'));
  }
  if (!finalImageUrl) throw new Error('Timed out waiting for Binance image processing.');

  return binancePost(V1 + '/content/add', {
    contentType: 1,
    bodyTextOnly: post_text,
    imageList: [finalImageUrl]
  });
}

export function formatResult(result) {
  if (result?.code === '000000') {
    const id = result?.data?.id;
    const link = result?.data?.shareLink || (id ? 'https://www.binance.com/square/post/' + id : null);
    return 'Binance API accepted the post.' + (id ? ' Post ID: ' + id + '.' : '') + (link ? ' Link: ' + link : '');
  }
  return 'Binance did not confirm success: ' + JSON.stringify(result).slice(0, 1800);
}
