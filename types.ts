
export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  completed: boolean;
  category: 'work' | 'personal' | 'urgent' | 'other';
  order: number;
}

export interface Alarm {
  id: string;
  time: string;
  days: number[];
  label: string;
  isActive: boolean;
  ringtone?: 'classic' | 'digital' | 'zen' | 'urgent' | 'custom';
  ringtoneUrl?: string;
  ringtoneName?: string;
  isSnoozed?: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
  color: string;
  isPinned?: boolean;
  tag?: 'work' | 'idea' | 'life' | 'urgent';
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  time: string;
}

export interface AlmanacData {
  yi: string[];
  ji: string[];
  summary?: string;
  festival?: string;
  lunarDate?: string;
  astrology?: string;
  sources?: { title: string; uri: string }[];
}

export interface WidgetSettings {
  orbSize: number;
  orbColor: string;
  accentColor: string;
  appName: string;
  animationEnabled: boolean;
  pulseEnabled: boolean;
  theme: 'light' | 'dark';
  weatherMode: 'auto' | 'manual';
  manualLocation: string;
  tabOrder?: TabId[];
  glassOpacity: number;
  glassBlur: number;
  playbackMode: 'loop' | 'single' | 'shuffle';
}

export type TabId = 'tasks' | 'weather' | 'calendar' | 'notes' | 'alarms' | 'music' | 'settings';

export interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  lunarDate: string;
  festival?: string;
  isHoliday?: boolean;
}

export interface MusicTrack {
  id?: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  duration?: number;
  sources?: { title: string; uri: string }[];
}

export interface Playlist {
  id: string;
  name: string;
  tracks: MusicTrack[];
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface ForecastHour {
  time: string;
  temp: string;
  condition: string;
}

export interface DailyForecast {
  date: string;
  maxTemp: string;
  minTemp: string;
  condition: string;
}

export interface WeatherInfo {
  temp: string;
  condition: string;
  location: string;
  humidity?: string;
  windSpeed?: string;
  uvIndex?: string;
  aqi?: string;
  visibility?: string;
  sunrise?: string;
  sunset?: string;
  forecast?: ForecastHour[];
  dailyForecast?: DailyForecast[];
  sources?: { title: string; uri: string }[];
}
