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

const developerBackendAvailable = useProxy || !!devApiKey;

/** Tier A: developer proxy/key and/or user key in browser. */
export function canCallFreeTierGemini(): boolean {
  return canUseFreeTierGemini({
    hasUserKey: hasUserGeminiKey(),
    useProxy,
    hasDeveloperKey: !!devApiKey,
  });
}

/** @deprecated use canCallFreeTierGemini */
export const canCallGemini = canCallFreeTierGemini;

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

export async function generateAgenda(file: File): Promise<any> {
  if (!canCallFreeTierGemini()) {
    console.error("Gemini API Key or proxy missing");
    throw new Error("API Key missing");
  }

  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const prompt = `
      Analyze the provided document and extract a schedule/agenda.
      Return ONLY a JSON array of objects. Do not include markdown formatting.
      Each object should have:
      - title (string)
      - startTime (HH:MM format, assume today's date if not specified)
      - endTime (HH:MM format, optional)
      - type ('meeting' or 'todo')
      - description (string, optional)

      If no specific time is mentioned, make reasonable assumptions starting from 9:00 AM.
    `;

    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: file.type || "application/octet-stream",
              data: base64Data,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      },
      "free_tier"
    );

    const text = response.text;
    if (!text) return [];

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON", text);
      return [];
    }
  } catch (error) {
    console.error("Error generating agenda:", error);
    return [];
  }
}

export async function generateDayName(
  events: ScheduleEvent[],
  language: string = "en"
): Promise<string> {
  if (!canCallFreeTierGemini() || events.length === 0) return "My Day";

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

    return response.text?.trim() || "A Busy Day";
  } catch (error: any) {
    if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429) {
      console.warn("Gemini quota exceeded, using fallback name.");
      return "A Busy Day";
    }
    console.error("Error generating day name:", error);
    return "A Busy Day";
  }
}

export async function generateQuote(args: {
  prompt: string;
  language?: string;
  theme?: string;
}): Promise<{ text: string; author?: string } | null> {
  const { prompt, language = "en" } = args;
  if (!canCallFreeTierGemini()) return null;

  try {
    const systemPrompt = `
      You generate ONE standalone quote for a daily scheduling app.
      Language: ${language === "zh" ? "Chinese (Simplified)" : "English"}
      Return ONLY JSON. No markdown. Schema:
      {
        "text": string,
        "author": string (optional)
      }
      Keep it short and memorable.
    `;

    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: [
          { text: systemPrompt },
          { text: `User request: ${prompt}` },
        ],
        config: {
          responseMimeType: "application/json",
        },
      },
      "free_tier"
    );

    const text = response.text;
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { text?: string; author?: string };
      if (!parsed?.text) return null;
      return { text: parsed.text.trim(), author: parsed.author?.trim() || undefined };
    } catch (e) {
      console.error("Failed to parse quote JSON", text);
      return null;
    }
  } catch (error) {
    console.error("Error generating quote:", error);
    return null;
  }
}

export interface DailySummaryOptions {
  dayName?: string;
  dayNameIsManual?: boolean;
  dayTag?: string;
  energy?: number;
  mood?: number;
  focus?: number;
  journal?: string;
}

export async function generateDailySummary(
  events: ScheduleEvent[],
  language: string = "en",
  options?: DailySummaryOptions
): Promise<string> {
  if (!canCallFreeTierGemini() || events.length === 0) return "";

  try {
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

    const parts: string[] = [];
    if (options?.dayName && options.dayNameIsManual) {
      parts.push(
        language === "zh"
          ? `用户为这一天起的名字：「${options.dayName}」。请在总结中呼应这一调性。`
          : `User named this day: "${options.dayName}". Weave this tone into the summary.`
      );
    }
    if (options?.dayTag) {
      parts.push(
        language === "zh"
          ? `当日主题标签：${options.dayTag}。`
          : `Day tag: ${options.dayTag}.`
      );
    }
    if (
      options?.energy != null ||
      options?.mood != null ||
      options?.focus != null
    ) {
      const v = [
        options.energy != null &&
          `${language === "zh" ? "能量" : "energy"}: ${options.energy}`,
        options.mood != null &&
          `${language === "zh" ? "情绪" : "mood"}: ${options.mood}`,
        options.focus != null &&
          `${language === "zh" ? "专注" : "focus"}: ${options.focus}`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(
        language === "zh"
          ? `当日状态：${v}。可写一句今日状态。`
          : `Today's state: ${v}. Optionally mention in one sentence.`
      );
    }
    if (options?.journal?.trim()) {
      parts.push(
        language === "zh"
          ? `用户日记：\n${options.journal.trim()}`
          : `User journal:\n${options.journal.trim()}`
      );
    }

    const extraBlock = parts.length ? "\n\n" + parts.join("\n") : "";

    const prompt = `
You are a personal assistant. Write a reflective **daily meaning summary** (今日意义) based on the following. Focus on what the day meant, not a flat list of events.

${language === "zh" ? "事件列表（含意义、高光/星标时已标注）：" : "Events (meaning and highlight/starred when present):"}
${eventLines}
${extraBlock}

Language: ${language === "zh" ? "Chinese (Simplified)" : "English"}
Tone: Reflective, encouraging, concise. Emphasize meaning and narrative.
- When an event has a "意义" (meaning), prioritize quoting or weaving that meaning as anchor points.
- Treat [高光] events as milestones; [星标] as key tasks. Acknowledge completion where relevant.
- Do not repeat a bare event list. Output should feel like "what this day meant in a nutshell."

Do not use markdown formatting like **bold** or # headers. Plain text or simple paragraphs only.
`.trim();

    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: prompt,
      },
      "free_tier"
    );

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "";
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

export async function generateRandomSchedule(
  mode: "chill" | "productive",
  language: string = "en"
): Promise<any[]> {
  try {
    const prompt = `
      You are a "Time Architect" for a narrative-based scheduling app called DayMuse.
      The user has an empty day and wants a suggested schedule.
      
      Mode: ${mode} (${mode === "chill" ? "Relaxed, restorative, slow living" : "High impact, deep work, structured flow"})
      Language: ${language === "zh" ? "Chinese (Simplified)" : "English"}
      
      Create a schedule of 3-5 events for today.
      
      Philosophy:
      - Time is designed, not filled.
      - Emphasize structure and themes.
      - For "Chill": Focus on reading, nature, coffee, reflection, light creative work.
      - For "Productive": Focus on deep work blocks, strategic thinking, breaks for clarity.
      
      Return ONLY a JSON array of objects. No markdown.
      Each object must have:
      - title (string): Creative, evocative title (e.g., "Deep Dive: Strategy" or "Morning Pages").
      - startTime (HH:MM format): Start times.
      - endTime (HH:MM format): End times.
      - type ('meeting' | 'todo' | 'personal'): Use 'personal' for breaks/chill, 'todo' for work.
      - description (string): A short, inspiring description of the activity.
    `;

    const response = await callGenerateContent(
      {
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      },
      "user_tier"
    );

    const text = response.text;
    if (!text) return [];

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON", text);
      return [];
    }
  } catch (error) {
    if (error instanceof UserGeminiKeyMissing) {
      throw error;
    }
    console.error("Error generating random schedule:", error);
    return [];
  }
}
