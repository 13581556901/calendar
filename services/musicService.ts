
import { GoogleGenAI, Type } from "@google/genai";
import { MusicTrack, LyricLine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 健壮的 API 调用包装器
 */
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

const FALLBACK_TRACKS: MusicTrack[] = [
  {
    title: "Lumina Ambient - 灵感流",
    artist: "Lumina AI",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "https://images.unsplash.com/photo-1459749411177-042180ce673c?w=400&h=400&fit=crop"
  },
  {
    title: "深空冥想 - 效率波",
    artist: "Lumina Studio",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop"
  }
];

export const searchMusic = async (query: string): Promise<MusicTrack | null> => {
  const prompt = `Find a high-quality publicly streamable direct audio link (MP3/OGG) for the song: "${query}". 
  Respond ONLY in JSON: {"title": "...", "artist": "...", "url": "...", "cover": "..."}`;

  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    }));

    const text = response.text || "{}";
    const data = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

    if (!data.url || !data.url.startsWith("http")) {
      throw new Error("Invalid URL from API");
    }
    
    return {
      title: data.title || query,
      artist: data.artist || "未知艺术家",
      url: data.url,
      cover: data.cover || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop"
    };
  } catch (error) {
    console.error("Music Search Error (Using Fallback):", error);
    // 报错时随机返回一首高质量备用曲目
    return FALLBACK_TRACKS[Math.floor(Math.random() * FALLBACK_TRACKS.length)];
  }
};

export const fetchLyrics = async (title: string, artist: string): Promise<LyricLine[]> => {
  const prompt = `Find lyrics for "${title}" by "${artist}". Format as JSON array: [{"time": seconds, "text": "..."}]`;

  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    }));

    const data = JSON.parse(response.text.match(/\[[\s\S]*\]/)?.[0] || "[]");
    return data;
  } catch (error) {
    return [
      { time: 0, text: "正在为您播放治愈系白噪音" },
      { time: 10, text: "专注此刻，灵感将至" },
      { time: 20, text: "Lumina 正在为您构筑纯净的创作环境" },
      { time: 100, text: "保持呼吸，保持高效" }
    ];
  }
};

export const getRandomInspiration = async (weather: string, time: string): Promise<string> => {
  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest one song name for ${weather} weather at ${time}. Name only.`
    }));
    return response.text?.trim() || "Lofi Hip Hop";
  } catch {
    return "Ambient Chill";
  }
};
