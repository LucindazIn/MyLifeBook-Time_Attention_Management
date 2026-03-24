/**
 * Gemini API 代理：API Key 仅保存在服务器环境变量，前端通过此代理调用，Key 不进入浏览器。
 * 启动：GEMINI_API_KEY=xxx node server/gemini-proxy.mjs
 * 或使用 .env.local：在项目根目录运行且已配置 dotenv 时自动加载。
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const PORT = process.env.GEMINI_PROXY_PORT || 3001;

if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY not set. Proxy will return 503.');
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// 允许 Vite 开发服务器跨域或同源代理
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/**
 * POST /generateContent
 * Body: { model, contents, config? } 与 @google/genai generateContent 参数一致
 * Response: { text?: string, error?: string }
 */
app.post('/generateContent', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'API Key not configured' });
  }
  try {
    const { model, contents, config } = req.body;
    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing model or contents' });
    }
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.0-flash',
      contents,
      config: config || {},
    });
    const text = response.text ?? '';
    res.json({ text });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    const status = err?.status === 429 || err?.code === 429 ? 429 : 500;
    res.status(status).json({
      error: err?.message || 'Proxy request failed',
      status: err?.status,
      code: err?.code,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini proxy running at http://localhost:${PORT} (API Key not exposed to client)`);
});
