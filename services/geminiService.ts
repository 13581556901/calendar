
import { GoogleGenAI, Type } from "@google/genai";
import { Task, AlmanacData, NewsItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const almanacCache: Record<string, AlmanacData> = {};

async function safeCallGemini(fn: () => Promise<any>, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      if (isRateLimit && i < retries - 1) {
        const delay = Math.pow(2, i) * 3000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

export const fetchLatestNews = async (): Promise<NewsItem[]> => {
  const prompt = `获取 5 条全球重要新闻。JSON: [{title, source, url, time}]`;

  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    }));

    const text = response.text || "[]";
    return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");
  } catch (error) {
    return [
      { title: "今日关键词：专注。即便 API 配额受限，您的效率不受限", source: "Lumina 系统", url: "#", time: "Now" },
      { title: "Lumina 温馨提示：合理规划休息，有助于保持长久创造力", source: "效率导师", url: "#", time: "Now" },
      { title: "新功能预告：更强大的 AI 桌面交互即将上线", source: "产品团队", url: "#", time: "Now" },
      { title: "今日宜：深度阅读、整理桌面、设定新的一周目标", source: "生活方式", url: "#", time: "Now" },
      { title: "运维播报：部分 API 正在自动扩容中，功能已切换至备用模式", source: "系统状态", url: "#", time: "Now" }
    ];
  }
};

export const getSmartAgendaSummary = async (tasks: Task[], dateStr: string) => {
  if (tasks.length === 0) return `在 ${dateStr}，你目前没有任何安排，是时候享受一段静谧时光了。`;
  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize tasks: ${JSON.stringify(tasks)}. Short, poetic.`,
    }));
    return response.text || "开启充满可能的一天。";
  } catch {
    return "保持专注，创造卓越。";
  }
};

export const fetchAlmanacData = async (date: string): Promise<AlmanacData | null> => {
  if (almanacCache[date]) return almanacCache[date];
  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Detailed almanac for ${date}. JSON: {yi, ji, festival, summary}`,
      config: { tools: [{ googleSearch: {} }] }
    }));
    const data = JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    almanacCache[date] = data;
    return data;
  } catch {
    const fallback = {
      yi: ["整理思路", "室内运动", "阅读"],
      ji: ["过度疲劳", "无序拖延"],
      festival: "常规工作日",
      summary: "心如止水，专注当下。即便外界环境波动，亦能自守清明。"
    };
    almanacCache[date] = fallback;
    return fallback;
  }
};
