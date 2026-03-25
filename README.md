<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# My Life Book

Narrative scheduling web app (人生之书). This repo contains everything you need to run the app locally.

**Storage:** `localStorage` keys still use the legacy `feather_` prefix so existing settings and cached chapter data continue to work; no key migration is required for the product rename.

View your app in AI Studio: https://ai.studio/apps/54045701-b3f4-419c-9a42-dce3af590f10

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies: `npm install`
2. Optional — **developer fallback (Tier A):** set `GEMINI_API_KEY` or `VITE_GEMINI_PROXY_URL` in `.env.local` so **day titles** and **journal meaning summaries** work without a per-user key. See [.env.example](.env.example).
3. **Your Gemini API key (Tier B):** in the app, open **Settings** and paste a key from [Google AI Studio](https://aistudio.google.com/apikey). Required for **chat**, **random schedule**, **AI summaries by tag/role**, and **Life Book chapters**. The key is stored **only in your browser** (localStorage), not sent to the app developer’s servers.
4. Run the app: `npm run dev`
5. Tests: `npm test`

### AI tiers (short)

| Tier | Who pays / which key | Features |
|------|----------------------|----------|
| A (free fallback) | Host `GEMINI_API_KEY` or proxy | Day name, journal “meaning” summary |
| B (user key) | User’s key in Settings | Chat, random schedule, filter AI summary, Life Book chapter generation |

If you use a browser-stored API key, treat XSS and dependency supply-chain risk seriously; restrict keys in Google Cloud where possible.
