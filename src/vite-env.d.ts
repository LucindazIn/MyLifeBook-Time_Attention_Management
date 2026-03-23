/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** 设置后走代理请求 Gemini，API Key 不进入前端 */
  readonly VITE_GEMINI_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
  };
};

declare module '@google/genai';

