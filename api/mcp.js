import OpenAI from 'openai';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { binancePost, postText, postWithImage, formatResult } from '../lib/binance.js';

const MCP_SECRET_PATH = process.env.MCP_SECRET_PATH;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const INSTRUCTIONS =
  'You help the user publish content to Binance Square. Before using either publishing tool, show the complete final post text and, for image posts, the image prompt or source image URL. Call a publishing tool only after the user explicitly approves that exact draft. Never provide financial advice or make unsupported market claims. Use the text-only tool unless the user asks for an image.';

function querySecret(req) {
  const value = req.query?.secret;
  return Array.isArray(value) ? value[0] : value;
}

function buildServer() {
  const server = new McpServer(
    { name: 'binance-square', version: '1.1.0' },
    { instructions: INSTRUCTIONS }
  );

  server.registerTool(
    'post_to_binance_square',
    {
      title: 'Post text to Binance Square',
      description: 'Publish a text-only Binance Square post. Use only after the user has explicitly approved the exact post text.',
      inputSchema: {
        post_text: z.string().trim().min(1).max(5000).describe('Final approved post text')
      }
    },
    async ({ post_text }) => {
      try {
        const result = await postText(post_text);
        return { content: [{ type: 'text', text: formatResult(result) }], isError: result?.code !== '000000' };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Publishing failed: ' + (error?.message || 'Unknown error') }], isError: true };
      }
    }
  );

  server.registerTool(
    'post_with_image_to_binance_square',
    {
      title: 'Post with image to Binance Square',
      description: 'Publish a post with one image from a public HTTPS image URL or an AI-generated image. Use only after the user approves the exact post text and image plan.',
      inputSchema: {
        post_text: z.string().trim().min(1).max(5000).describe('Final approved post text'),
        image_prompt: z.string().trim().min(1).max(1200).optional().describe('Image-generation prompt; used if image_url is not provided'),
        image_url: z.string().url().optional().describe('Public direct HTTPS URL to a supported image')
      }
    },
    async ({ post_text, image_prompt, image_url }) => {
      try {
        if ((!image_url || !image_url.trim()) && (!image_prompt || !image_prompt.trim())) {
          throw new Error('Provide either image_url or image_prompt.');
        }
        if (image_url && image_prompt) {
          throw new Error('Provide only one of image_url or image_prompt.');
        }
        const result = await postWithImage({ post_text, image_prompt, image_url, openai });
        return { content: [{ type: 'text', text: formatResult(result) }], isError: result?.code !== '000000' };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Image post failed: ' + (error?.message || 'Unknown error') }], isError: true };
      }
    }
  );

  return server;
}

export default async function handler(req, res) {
  if (!MCP_SECRET_PATH) {
    return res.status(503).json({ error: 'MCP_SECRET_PATH is not configured in Vercel environment variables.' });
  }

  if (querySecret(req) !== MCP_SECRET_PATH) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] Request failed:', error?.message || error);
    if (!res.headersSent) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null
      });
    }
  }
}
