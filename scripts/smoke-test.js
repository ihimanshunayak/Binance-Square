import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import cronHandler from '../api/cron-news.js';

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('health endpoint returns runtime status on GET', () => {
  const req = { method: 'GET' };
  const res = responseMock();
  healthHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'binance-square');
  assert.equal(typeof res.body.features, 'object');
  assert.equal(JSON.stringify(res.body).includes('sk-'), false);
});

test('health endpoint rejects non-GET methods', () => {
  const req = { method: 'POST' };
  const res = responseMock();
  healthHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});

test('news endpoint fails closed when CRON_SECRET is missing', async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const req = { method: 'GET', headers: {} };
    const res = responseMock();
    await cronHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.ok, false);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('news endpoint rejects an incorrect cron secret', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'ci-test-secret-only';
  try {
    const req = { method: 'GET', headers: { authorization: 'Bearer wrong-secret' } };
    const res = responseMock();
    await cronHandler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Unauthorized');
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
