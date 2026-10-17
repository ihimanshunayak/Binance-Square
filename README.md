# Binance Square MCP & Crypto News Automation

Vercel-hosted Node.js MCP server for Binance Square publishing plus optional CoinDesk news drafting/posting.

## What is implemented

- Public landing page at `/`.
- Safe health endpoint at `/api/health` (reports configuration booleans only; never returns secret values).
- Stateless Streamable HTTP MCP endpoint at `/mcp/<MCP_SECRET_PATH>` (rewritten internally to the Vercel function).
- MCP tools:
  - `post_to_binance_square`: text-only post.
  - `post_with_image_to_binance_square`: image URL or AI-generated image plus post text.
- Protected scheduled-news endpoint at `/api/cron-news`.
- CoinDesk RSS and article extraction, original post drafting, optional generated image, and Supabase-backed duplicate tracking.
- SSRF guard and 8 MB limit for user-supplied image URLs.

## Deploy

1. Import this repository in Vercel: https://vercel.com/new.
2. Vercel will deploy from `main` when Git integration is connected.
3. Add the environment variables below in Vercel Project Settings -> Environment Variables, then redeploy.
4. Open `/api/health` and confirm `ok: true`. This checks runtime/configuration only, not that your external API credentials actually work.
5. Keep news disabled or in dry-run until you test the generated draft. Do not enable live publishing without deliberately configuring the Binance and OpenAI credentials.

## Required environment variables

- `BINANCE_SQUARE_API_KEY`: Binance Square OpenAPI key.
- `MCP_SECRET_PATH`: a long random secret used as the `secret` query value in the MCP URL.
- `OPENAI_API_KEY`: required for AI-generated images and news drafts. Text-only manual posts do not need OpenAI.
- `OPENAI_TEXT_MODEL`: defaults to `gpt-4.1-mini`; you can override it with a model available to your API key.
- `OPENAI_IMAGE_MODEL`: defaults to `gpt-image-2`.
- `CRON_SECRET`: required for scheduled news requests. Vercel sends this as a Bearer token for Cron invocations.
- `NEWS_ENABLED`: keep `false` until configured.
- `NEWS_DRY_RUN`: defaults safely to `true`; set it to `false` only when you want live posts.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`): server-side Supabase credentials for persistent news deduplication and job locking. Keep these keys private; never use them in browser/client code.

Create the storage table once in the Supabase SQL Editor:

```sql
create table if not exists public.binance_square_kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.binance_square_kv enable row level security;
```

The server uses the service/secret key from Vercel, which bypasses RLS. Do not create public policies for this table.

Optional variables: `NEWS_POSTS_PER_RUN` (1-3, default 1), `NEWS_MAX_AGE_HOURS` (default 48; older stories are skipped), `NEWS_POST_LANGUAGE` (default English), `NEWS_IMAGE_MODE` (`generate`, `none`, or `source`; default `generate`). Reusing CoinDesk source images requires appropriate reuse rights; generated original art is the default.

## MCP connector URL

After setting `MCP_SECRET_PATH` in Vercel, connect your MCP client to:

```
https://YOUR-VERCEL-DOMAIN/mcp/YOUR_MCP_SECRET_PATH
```

Treat the URL as a password. Don't put the actual secret in GitHub, issue comments, screenshots, or public docs.

## Scheduled news

The repository config schedules `/api/cron-news` once daily at 03:30 UTC (09:00 Asia/Kolkata). Vercel Hobby plans do not allow schedules more frequently than once daily. Pro can use `0 */3 * * *` for every three hours if that is desired.

The route first checks `CRON_SECRET`, then `NEWS_ENABLED`. Dry-run is on by default and shows draft output without publishing. Live posting requires:
1. Set `NEWS_ENABLED=true`.
2. Set `NEWS_DRY_RUN=false`.
3. Configure `BINANCE_SQUARE_API_KEY`, `OPENAI_API_KEY`, and the Supabase server-side URL/key. Confirm `/api/health` reports `supabaseStorageReachable: true`.
4. Verify model availability and image-generation permissions on the OpenAI API key.
5. Review a dry-run draft before enabling live posts.

## Security & operational notes

- Never commit `.env` or any real API keys.
- Rotate any secret accidentally exposed in a public repository.
- Publishing tools should only be called after the user explicitly approves the exact draft.
- Binance API response formats and credentials must be verified with a controlled real test; this code cannot prove external credentials are valid by itself.
- Vercel Functions are request-driven. This project does not use an in-process scheduler or local `posted-news.json`; Supabase stores article IDs and the job lock durably.
