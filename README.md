# Binance Square MCP & Crypto News Automation

Node.js project for Binance Square posting with an optional CoinDesk crypto-news workflow.

**Current repository status: Vercel deployment scaffold, not a complete/live publisher yet.** The API routes make the project structure deployable for testing but intentionally do not publish posts until the MCP transport, Binance/OpenAI calls, and persistent news deduplication are ported and verified.

## Current files

- `api/health.js` — Vercel health-check function.
- `api/mcp.js` — fail-closed placeholder; original MCP Streamable HTTP transport still needs a Vercel adapter.
- `api/cron-news.js` — protected placeholder for a future Vercel Cron job. It currently returns HTTP 501 and does not publish.
- `package.json` — original project dependencies.
- `.env.example` — variable names only; no secrets.

## Deploy to Vercel

1. Import `ihimanshunayak/Binance-Square` from GitHub at https://vercel.com/new.
2. Choose the project root and use the Node.js functions defaults.
3. Add required secrets under Project Settings → Environment Variables. Never commit real credentials.
4. Deploy, then verify `GET /api/health` returns `{ "ok": true, ... }`.

## Required environment variables

- `BINANCE_SQUARE_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (optional if only using direct image URLs)
- `OPENAI_TEXT_MODEL` (must be a model enabled for your OpenAI API key)
- `MCP_SECRET_PATH` (long random secret)
- `CRON_SECRET` (long random secret for scheduled endpoint)
- `NEWS_ENABLED` (keep `false` until completed and tested)
- `NEWS_DRY_RUN` (keep `true` until end-to-end tests pass)

## Important Vercel limitations

The original source uses `app.listen()`, an in-process `node-cron` scheduler, and `posted-news.json`. These are not a reliable Vercel Functions deployment pattern. Vercel Functions are request-driven, so use Vercel Cron or an external scheduler and persist article IDs in Redis or a database. Do not rely on a local file for deduplication.

## Before live posting

- Implement the MCP Streamable HTTP transport for Vercel's request/response handler.
- Port the original Binance post and image-upload logic into serverless-compatible handlers.
- Implement secure, authenticated cron invocation and persistent deduplication.
- Confirm the OpenAI text model name works with the configured key.
- Test image downloads with URL validation, MIME/size limits and timeouts.
- Run dry-run tests and inspect the exact post. Enable live publishing only after explicit configuration.

## Secrets

Never expose Binance keys, OpenAI keys, `MCP_SECRET_PATH`, `CRON_SECRET`, `.env`, or production tokens in a public repository. Rotate any credential that is accidentally committed.
