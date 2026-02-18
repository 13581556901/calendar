
import { GoogleGenAI } from "@google/genai";
import { WeatherInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const weatherCache: Record<string, { data: WeatherInfo, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 60; 

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

const getFallbackWeather = (location: string): WeatherInfo => ({
  temp: "23°C",
  condition: "Sunny",
  location: location || "北京",
  humidity: "40%",
  windSpeed: "8 km/h",
  uvIndex: "Moderate",
  aqi: "Good",
  visibility: "15 km",
  sunrise: "06:00 AM",
  sunset: "07:00 PM",
  forecast: [],
  dailyForecast: [],
  sources: []
});

export const getLiveWeather = async (params: { lat?: number, lon?: number, location?: string }): Promise<WeatherInfo | null> => {
  const { location } = params;
  const cacheKey = location || "default";
  
  if (weatherCache[cacheKey] && (Date.now() - weatherCache[cacheKey].timestamp < CACHE_TTL)) {
    return weatherCache[cacheKey].data;
  }

  try {
    const response = await safeCallGemini(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current weather for ${location}. JSON format.`,
      config: { tools: [{ googleSearch: {} }] }
    }));

    const data = JSON.parse(response.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const result = { ...getFallbackWeather(location || ""), ...data };
    weatherCache[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return weatherCache[cacheKey]?.data || getFallbackWeather(location || "北京");
  }
};
