import { GoogleGenAI } from "@google/genai";
import { ScheduleEvent } from "@/types";
import { getUserGeminiKey, hasUserGeminiKey } from "@/lib/userGeminiKeyStorage";
import { UserGeminiKeyMissing } from "@/lib/geminiErrors";
import { canUseFreeTierGemini, type GeminiCallTier } from "@/lib/geminiRouting";

export { UserGeminiKeyMissing, isUserGeminiKeyMissing } from "@/lib/geminiErrors";
export { hasUserGeminiKey, getUserGeminiKey, setUserGeminiKey, clearUserGeminiKey } from "@/lib/userGeminiKeyStorage";

/** Output of the weekly narrative chapter (人生档案整理师). */
export interface WeeklyChapterOutput {
  chapterTitles: [string, string, string];
  narrativeSummary: string;
  reflectionQuestions: [string, string];
}

const GEMINI_MODEL = "gemini-2.0-flash";

/*
 * Routing (keep in sync with plan / docs):
 *
 * [User] -- free_tier --> callGenerateContent
 *              |
 *      +-------+-------+
 *      |               |
 * has userKey?    yes: browser -> Google (user key)
 *      |
 *     no: VITE_GEMINI_PROXY_URL ? proxy : GEMINI_API_KEY ? browser (dev key)
 *
 * [User] -- user_tier --> must have user key -> browser -> Google (user key only)
 */

const devApiKey = process.env.GEMINI_API_KEY;
const proxyUrl = import.meta.env?.VITE_GEMINI_PROXY_URL;
const useProxy = !!proxyUrl;

/** Tier A: developer proxy/key and/or user key in browser. */
export function canCallFreeTierGemini(): boolean {
  return canUseFreeTierGemini({
    hasUserKey: hasUserGeminiKey(),
    useProxy,
    hasDeveloperKey: !!devApiKey,
  });
}

async function generateWithClient(
  ai: InstanceType<typeof GoogleGenAI>,
  params: { model: string; contents: string | object[]; config?: object }
): Promise<{ text: string }> {
  const response = await ai.models.generateContent(params);
  return { text: response.text ?? "" };
}

/** Unified Gemini generateContent: never sends user key through developer proxy. */
async function callGenerateContent(
  params: {
    model: string;
    contents: string | object[];
    config?: object;
  },
  tier: GeminiCallTier
): Promise<{ text: string }> {
  if (tier === "user_tier") {
    const userKey = getUserGeminiKey();
    if (!userKey) {
      throw new UserGeminiKeyMissing();
    }
    const ai = new GoogleGenAI({ apiKey: userKey });
    return generateWithClient(ai, params);
  }

  // free_tier
  const userKey = getUserGeminiKey();
  if (userKey) {
    const ai = new GoogleGenAI({ apiKey: userKey });
    return generateWithClient(ai, params);
  }

  if (useProxy && proxyUrl) {
    const base = proxyUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        contents: params.contents,
        config: params.config || {},
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: number;
        code?: number;
      };
      const err = new Error(data.error || res.statusText) as Error & {
        status?: number;
        code?: number;
      };
      err.status = data.status;
      err.code = data.code;
      throw err;
    }
    const data = (await res.json()) as { text?: string };
    return { text: data.text ?? "" };
  }

  if (devApiKey) {
    const ai = new GoogleGenAI({ apiKey: devApiKey });
    return generateWithClient(ai, params);
  }

  throw new Error("API Key missing");
}

export type GenerateDayNameResult = { name: string; usedFallback: boolean };

export async function generateDayName(
  events: ScheduleEvent[],
  language: string = "en"
): Promise<GenerateDayNameResult> {
  if (!canCallFreeTierGemini() || events.length === 0) {
    return { name: "My Day", usedFallback: true };
  }

  try {
    const eventTitles = events.map((e) => e.title).join(", ");
    const prompt = `
      Given these events for a day: "${eventTitles}".
      Generate a creative, literary, and memorable title for this day. 
      Language: ${language === "zh" ? "Chinese (Simplified)" : "English"}
      Think like a novelist naming a chapter, or a poet naming a poem.
      Avoid generic descriptions like "Busy Work Day".
      Aim for something evocative, perhaps slightly abstract or metaphorical, but still grounded in the day's content.
      Max 5-7 words. Do not use quotes.
      
      Examples of the vibe:
      - "The Long Wait for Winter"
      - "Coffee, Chaos, and the Quiet After"
      - "Chapter 4: The Great Unraveling"
      - "Echoes of a Morning Meeting"
      - "The Art of Doing Nothing"
    `;

    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: prompt,
      },
      "free_tier"
    );

    const text = response.text?.trim();
    if (!text) return { name: "A Busy Day", usedFallback: true };
    return { name: text, usedFallback: false };
  } catch (error: any) {
    if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429) {
      console.warn("Gemini quota exceeded, using fallback name.");
      return { name: "A Busy Day", usedFallback: true };
    }
    console.error("Error generating day name:", error);
    return { name: "A Busy Day", usedFallback: true };
  }
}

export interface SummaryByFilterOptions {
  byTag?: string;
  byRole?: string;
}

export async function generateSummaryByFilter(
  events: ScheduleEvent[],
  language: string = "en",
  options: SummaryByFilterOptions
): Promise<string> {
  const { byTag, byRole } = options;
  if (!byTag && !byRole) return "";

  const eventLines = events
    .map((e) => {
      const meaning = e.meaning?.trim() ? ` | 意义: ${e.meaning.trim()}` : "";
      const badges: string[] = [];
      if (e.highlight) badges.push("高光");
      if (e.starred) badges.push("星标");
      const badge = badges.length ? ` [${badges.join(",")}]` : "";
      return `- ${e.title} @ ${e.startTime} ${e.completed ? "✓" : ""}${badge}${meaning}`;
    })
    .join("\n");

  const filterDesc =
    language === "zh"
      ? byTag
        ? `以下事件均带有标签「${byTag}」。`
        : `以下事件均属于角色「${byRole}」。`
      : byTag
        ? `All events below have tag "${byTag}".`
        : `All events below are for role "${byRole}".`;

  const prompt = `
You are a personal assistant. Write a short narrative summary (2–4 sentences) for this set of events. Do not list events one by one.

${filterDesc}

Events (meaning and highlight/starred when present):
${eventLines || (language === "zh" ? "（无事件）" : "(No events)")}

Language: ${language === "zh" ? "Chinese (Simplified)" : "English"}
- Prioritize quoting or weaving any "意义" (meaning) the user wrote as anchor points.
- Treat [高光] as milestones and [星标] as key tasks. Keep it concise and narrative.
Do not use markdown. Plain text only.
`.trim();

  try {
    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: prompt,
      },
      "user_tier"
    );
    return response.text?.trim() || "";
  } catch (error) {
    if (error instanceof UserGeminiKeyMissing) {
      throw error;
    }
    console.error("Error generating summary by filter:", error);
    return "";
  }
}
