# Binance Square MCP & Crypto News Automation

Node.js MCP server designed to publish text or image posts to Binance Square, with optional CoinDesk crypto-news drafting automation.

> **Deployment status:** source scaffold only. Configure and test before enabling live publishing.

## Features

- MCP tools for text-only posts and posts with an image.
- Optional OpenAI image generation.
- CoinDesk RSS/article ingestion for crypto-news drafts.
- Vercel-compatible API routes and scheduled execution should be configured before deployment.

## Security

- Never commit `.env`, API keys, access tokens, secret URLs, or production credentials.
- Store `BINANCE_SQUARE_API_KEY`, `OPENAI_API_KEY`, `MCP_SECRET_PATH`, and `CRON_SECRET` only in the Vercel project environment variables.
- Keep dry-run enabled until model output and Binance API responses are verified.
- Publicly reuse of CoinDesk images may raise copyright concerns; prefer original generated imagery or imagery with appropriate rights.

## Vercel notes

The original standalone Express server and `node-cron` scheduler are not directly suitable as always-running processes on Vercel Functions. Convert the MCP endpoint to a Vercel-compatible function, use Vercel Cron or an external scheduler, and store posted article IDs in persistent storage (for example, Redis/KV or a database) rather than a local JSON file.

Do not switch on live publishing until the deployment, authentication, deduplication, and real API calls have been tested.
