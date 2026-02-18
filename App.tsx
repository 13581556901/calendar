
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, Alarm, Note, DayInfo, WidgetSettings, TabId, LyricLine, AlmanacData, MusicTrack, WeatherInfo, NewsItem } from './types';
import { getSmartAgendaSummary, fetchAlmanacData, fetchLatestNews } from './services/geminiService';
import { getLiveWeather } from './services/weatherService';
import { searchMusic, fetchLyrics } from './services/musicService';
import { getLunarDate, getLunarInfo, getSolarFestival } from './utils/lunar';
import TaskItem from './components/TaskItem';
import AlarmCard from './components/AlarmCard';
import NoteItem from './components/NoteItem';
import AudioVisualizer from './components/AudioVisualizer';

const RINGTOWN_SOUNDS: Record<string, { url: string; label: string; icon: string }> = {
  classic: { url: 'https://actions.google.com/sounds/v1/alarms/alarm_clock_clanging.ogg', label: '经典铃声', icon: 'fa-bell' },
  digital: { url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg', label: '电子脉冲', icon: 'fa-microchip' },
  zen: { url: 'https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg', label: '禅意晨鸣', icon: 'fa-leaf' },
  urgent: { url: 'https://actions.google.com/sounds/v1/alarms/emergency_itds.ogg', label: '紧急突发', icon: 'fa-triangle-exclamation' }
};

const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#fed7aa', '#bfdbfe', '#ddd6fe', '#fecaca'];
const ACCENT_PRESETS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316'];

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "99, 102, 241";
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  // --- Core States ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [noteFilter, setNoteFilter] = useState<'all' | 'work' | 'idea' | 'life' | 'urgent'>('all');
  const [noteSearch, setNoteSearch] = useState('');
  
  const [settings, setSettings] = useState<WidgetSettings>({
    orbSize: 85, orbColor: '#6366f1', accentColor: '#6366f1', appName: 'LUMINA',
    animationEnabled: true, pulseEnabled: true, theme: 'light', weatherMode: 'manual',
    manualLocation: '北京',
    tabOrder: ['tasks', 'calendar', 'notes', 'alarms', 'music', 'weather', 'settings'],
    glassOpacity: 88, glassBlur: 30, playbackMode: 'loop'
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [dayAlmanac, setDayAlmanac] = useState<AlmanacData | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [overlayView, setOverlayView] = useState<'weather' | 'almanac' | null>(null);
  const [isWeatherPanelPinned, setIsWeatherPanelPinned] = useState(false);

  // --- Modal States ---
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // --- Form States ---
  const [newTask, setNewTask] = useState<Partial<Task>>({ 
    title: '', description: '', time: '09:00', category: 'work', date: ''
  });
  const [newAlarm, setNewAlarm] = useState<Partial<Alarm>>({ 
    time: '08:00', label: '', days: [], ringtone: 'classic' 
  });
  const [newNote, setNewNote] = useState<Partial<Note>>({ content: '', color: NOTE_COLORS[0], tag: 'life' });

  // --- Audio States ---
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [lastRungMinute, setLastRungMinute] = useState("");
  const [selectedAlarmIds, setSelectedAlarmIds] = useState<Set<string>>(new Set());
  const [isAlarmSelectMode, setIsAlarmSelectMode] = useState(false);

  // --- Music & Audio Engine ---
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [musicCurrentTime, setMusicCurrentTime] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDark = settings.theme === 'dark';

  // --- Initialization & Persistence ---
  useEffect(() => {
    const val = localStorage.getItem('lumina_settings');
    if (val) setSettings(prev => ({...prev, ...JSON.parse(val)}));
    
    const t = localStorage.getItem('lumina_tasks');
    if (t) setTasks(JSON.parse(t));
    const a = localStorage.getItem('lumina_alarms');
    if (a) setAlarms(JSON.parse(a));
    const n = localStorage.getItem('lumina_notes');
    if (n) setNotes(JSON.parse(n));
  }, []);

  useEffect(() => {
    localStorage.setItem('lumina_tasks', JSON.stringify(tasks));
    localStorage.setItem('lumina_alarms', JSON.stringify(alarms));
    localStorage.setItem('lumina_notes', JSON.stringify(notes));
    localStorage.setItem('lumina_settings', JSON.stringify(settings));

    const root = document.documentElement;
    root.style.setProperty('--accent-color', settings.accentColor);
    root.style.setProperty('--accent-color-rgb', hexToRgb(settings.accentColor));
    root.style.setProperty('--glass-opacity', (settings.glassOpacity / 100).toString());
    root.style.setProperty('--glass-blur', `${settings.glassBlur}px`);
  }, [tasks, alarms, notes, settings]);

  // --- News Fetching ---
  useEffect(() => {
    fetchLatestNews().then(setNews);
    const interval = setInterval(() => fetchLatestNews().then(setNews), 1000 * 60 * 60); 
    return () => clearInterval(interval);
  }, []);

  // --- Clock & Alarm Heartbeat ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const minStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      
      if (minStr !== lastRungMinute) {
        const alarm = alarms.find(a => a.isActive && a.time === minStr && (a.days.length === 0 || a.days.includes(now.getDay())));
        if (alarm) {
          setRingingAlarm(alarm);
          setLastRungMinute(minStr);
          if (alarmAudioRef.current) {
            const soundUrl = (alarm.ringtone === 'custom' && alarm.ringtoneUrl) 
              ? alarm.ringtoneUrl 
              : RINGTOWN_SOUNDS[alarm.ringtone || 'classic'].url;
            alarmAudioRef.current.src = soundUrl;
            alarmAudioRef.current.loop = true;
            alarmAudioRef.current.play().catch((e) => console.error("Alarm Play Error:", e));
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [alarms, lastRungMinute, ringingAlarm]);

  // --- Weather Synchronization ---
  const fetchWeatherNow = async () => {
    setIsWeatherLoading(true);
    try {
      const data = await getLiveWeather({ location: settings.manualLocation });
      if (data) setWeather(data);
    } catch (e) { console.error(e); }
    finally { setIsWeatherLoading(false); }
  };

  useEffect(() => {
    fetchWeatherNow();
    const interval = setInterval(fetchWeatherNow, 1000 * 60 * 30);
    return () => clearInterval(interval);
  }, [settings.manualLocation]);

  useEffect(() => {
    const ds = selectedDate.toISOString().split('T')[0];
    fetchAlmanacData(ds).then(setDayAlmanac);
    getSmartAgendaSummary(tasks.filter(t => t.date === ds), ds).then(setAiSummary);
  }, [selectedDate, tasks.length]);

  const calendarDays = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const days: DayInfo[] = [];
    const build = (d: Date, isCurr: boolean) => ({
      date: d, isCurrentMonth: isCurr, isToday: d.toDateString() === new Date().toDateString(),
      tasks: tasks.filter(t => t.date === d.toISOString().split('T')[0]),
      lunarDate: getLunarInfo(d).lunarDay,
      festival: getSolarFestival(d) || getLunarInfo(d).festival
    });
    for (let i = first; i > 0; i--) days.push(build(new Date(y, m, 1 - i), false));
    for (let i = 1; i <= count; i++) days.push(build(new Date(y, m, i), true));
    while (days.length < 42) days.push(build(new Date(y, m + 1, days.length - first - count + 1), false));
    return days;
  }, [viewDate, tasks]);

  const handleOpenTaskModal = () => {
    setNewTask({
      title: '',
      description: '',
      time: '09:00',
      category: 'work',
      date: selectedDate.toISOString().split('T')[0]
    });
    setShowTaskModal(true);
  };

  const handleAddTask = () => {
    if (!newTask.title || !newTask.date) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title: newTask.title || '',
      description: newTask.description || '',
      date: newTask.date,
      time: newTask.time,
      completed: false,
      category: (newTask.category as any) || 'work',
      order: tasks.length
    };
    setTasks([...tasks, task]);
    setShowTaskModal(false);
  };

  const handleMusicPlay = async (track: MusicTrack) => {
    if (!audioPlayerRef.current) return;
    setCurrentTrack(track);
    setLyrics([]);
    setIsLyricsLoading(true);
    audioPlayerRef.current.src = track.url;
    audioPlayerRef.current.play();
    setIsPlaying(true);

    if (!analyserRef.current) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(audioPlayerRef.current);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        analyserRef.current = analyser;
    }

    fetchLyrics(track.title, track.artist).then(l => {
        setLyrics(l);
        setIsLyricsLoading(false);
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setMusicCurrentTime(time);
    if (audioPlayerRef.current) audioPlayerRef.current.currentTime = time;
  };

  const activeLyricIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (musicCurrentTime >= lyrics[i].time) index = i;
      else break;
    }
    return index;
  }, [lyrics, musicCurrentTime]);

  useEffect(() => {
    if (lyricsContainerRef.current && activeLyricIndex !== -1) {
      const activeElement = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeElement) {
        const containerHeight = lyricsContainerRef.current.offsetHeight;
        lyricsContainerRef.current.scrollTo({
          top: activeElement.offsetTop - containerHeight / 2 + activeElement.offsetHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [activeLyricIndex]);

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.content.toLowerCase().includes(noteSearch.toLowerCase());
      const matchesFilter = noteFilter === 'all' || n.tag === noteFilter;
      return matchesSearch && matchesFilter;
    }).sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [notes, noteSearch, noteFilter]);

  const handleSnooze = () => {
    if (!ringingAlarm) return;
    setRingingAlarm(null);
    alarmAudioRef.current?.pause();
    const [h, m] = ringingAlarm.time.split(':').map(Number);
    let nextM = (m + 9) % 60;
    let nextH = (h + Math.floor((m + 9) / 60)) % 24;
    const snoozeTime = `${nextH.toString().padStart(2,'0')}:${nextM.toString().padStart(2,'0')}`;
    setAlarms(alarms.map(a => a.id === ringingAlarm.id ? {...a, time: snoozeTime, isSnoozed: true} : a));
  };

  const toggleDayInNewAlarm = (dayIdx: number) => {
    const currentDays = newAlarm.days || [];
    const nextDays = currentDays.includes(dayIdx)
      ? currentDays.filter(d => d !== dayIdx)
      : [...currentDays, dayIdx];
    setNewAlarm({ ...newAlarm, days: nextDays });
  };

  const handleAddNote = () => {
    if (!newNote.content) return;
    const note: Note = {
      id: crypto.randomUUID(),
      content: newNote.content || '',
      timestamp: Date.now(),
      color: newNote.color || NOTE_COLORS[0],
      tag: newNote.tag as any || 'life'
    };
    setNotes([note, ...notes]);
    setShowNoteModal(false);
    setNewNote({ content: '', color: NOTE_COLORS[0], tag: 'life' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setNewAlarm({ ...newAlarm, ringtone: 'custom', ringtoneUrl: url, ringtoneName: file.name });
    }
  };

  const clearAllAlarms = () => {
    if (window.confirm("确定要删除所有闹钟吗？")) {
      setAlarms([]);
      setSelectedAlarmIds(new Set());
      setIsAlarmSelectMode(false);
    }
  };

  const toggleAlarmSelection = (id: string) => {
    const next = new Set(selectedAlarmIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAlarmIds(next);
  };

  const deleteSelectedAlarms = () => {
    if (selectedAlarmIds.size === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedAlarmIds.size} 个闹钟吗？`)) {
      setAlarms(alarms.filter(a => !selectedAlarmIds.has(a.id)));
      setSelectedAlarmIds(new Set());
      setIsAlarmSelectMode(false);
    }
  };

  const glassStyle: React.CSSProperties = {
    backgroundColor: isDark ? `rgb(15 23 42 / var(--glass-opacity))` : `rgb(255 255 255 / var(--glass-opacity))`,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    backdropFilter: `blur(var(--glass-blur)) saturate(180%)`,
    WebkitBackdropFilter: `blur(var(--glass-blur)) saturate(180%)`,
    boxShadow: isDark ? '0 50px 100px -20px rgba(0,0,0,0.5)' : '0 50px 100px -20px rgba(0,0,0,0.12)'
  };

  const weatherIcons: Record<string, string> = {
    'Sunny': 'fa-sun text-amber-400', 'Clear': 'fa-moon text-indigo-300', 'Cloudy': 'fa-cloud text-slate-400',
    'Rainy': 'fa-cloud-showers-heavy text-blue-400', 'Stormy': 'fa-bolt text-indigo-500', 
    'Snowy': 'fa-snowflake text-sky-100', 'Partly Cloudy': 'fa-cloud-sun text-orange-300'
  };

  const selectedDayTasks = useMemo(() => {
    const ds = selectedDate.toISOString().split('T')[0];
    return tasks.filter(t => t.date === ds);
  }, [tasks, selectedDate]);

  return (
    <div className={`fixed top-1/2 -translate-y-1/2 right-6 z-50 theme-transition ${isExpanded ? 'w-[520px] h-[94vh]' : 'w-24 h-24'}`}>
      
      {!isExpanded && (
        <div onClick={() => setIsExpanded(true)} className="absolute inset-0 flex items-center justify-center cursor-pointer group">
          <div className={`rounded-full flex items-center justify-center relative shadow-2xl animate-orb border glass-border theme-transition hover:scale-110 active:scale-95 overflow-hidden`} 
               style={{ ...glassStyle, width: settings.orbSize, height: settings.orbSize } as any}>
            <div className={`flex flex-col items-center z-10 theme-transition ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <span className="text-[17px] font-black font-mono-premium leading-none">{currentTime.getHours()}:{currentTime.getMinutes().toString().padStart(2,'0')}</span>
              <div className="flex items-center gap-1.5 mt-1 opacity-50">
                 <i className={`fas ${weatherIcons[weather?.condition || 'Sunny']} text-[9px]`}></i>
                 <span className="text-[9px] font-black">{weather?.temp || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`w-full h-full rounded-[48px] overflow-hidden flex flex-col theme-transition relative border glass-border ${isExpanded ? 'opacity-100 scale-100 shadow-3xl' : 'opacity-0 scale-95 pointer-events-none'}`} style={glassStyle}>
        
        <div className="mesh-gradient absolute inset-0 pointer-events-none opacity-40"></div>
        <div className="noise-overlay"></div>

        <div className="relative z-[100] px-10 pt-8 pb-4 flex items-center justify-between">
           <div 
             className="flex items-center gap-4 cursor-pointer group p-1.5 transition-all rounded-full hover:bg-black/5" 
             onMouseEnter={() => { if(!isWeatherPanelPinned) setOverlayView('weather'); }}
             onMouseLeave={() => { if(!isWeatherPanelPinned) setOverlayView(null); }}
             onClick={() => { setIsWeatherPanelPinned(!isWeatherPanelPinned); setOverlayView('weather'); }}
           >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-black/5 border glass-border group-hover:bg-white transition-colors relative">
                {isWeatherLoading && <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>}
                <i className={`fas ${weatherIcons[weather?.condition || 'Sunny']} text-xs`}></i>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>{weather?.location || settings.manualLocation}</span>
                  <span className={`text-[10px] font-black ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{weather?.temp}</span>
                </div>
                <span className="text-[8px] font-bold opacity-30 uppercase">{weather?.condition || '同步中...'}</span>
              </div>
              <div className={`transition-opacity ml-1 ${isWeatherPanelPinned ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-40'}`}>
                 <i className={`fas ${isWeatherPanelPinned ? 'fa-thumbtack' : 'fa-circle-info'} text-[10px]`}></i>
              </div>
           </div>
           
           <div className="flex gap-2">
             <button onClick={() => setOverlayView(overlayView === 'almanac' ? null : 'almanac')} className={`w-9 h-9 rounded-full flex items-center justify-center border glass-border transition-all ${overlayView === 'almanac' ? 'text-white shadow-lg' : 'bg-black/5 text-slate-400 hover:bg-white'}`} style={overlayView === 'almanac' ? {backgroundColor: 'var(--accent-color)'} : {}}>
                <i className="fas fa-calendar-day text-[10px]"></i>
             </button>
             <button onClick={() => setActiveTab('settings')} className={`w-9 h-9 rounded-full flex items-center justify-center border glass-border transition-all ${activeTab === 'settings' ? 'text-white shadow-lg' : 'bg-black/5 text-slate-400 hover:bg-white'}`} style={activeTab === 'settings' ? {backgroundColor: 'var(--accent-color)'} : {}}>
                <i className={`fas fa-gear text-[10px]`}></i>
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Weather Detail Overlay */}
          {overlayView === 'weather' && weather && (
            <div className="absolute inset-x-0 top-0 bottom-[100px] z-[500] px-10 py-6 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-auto">
               <div className={`p-8 rounded-[48px] border glass-border ${isDark ? 'bg-slate-900/60' : 'bg-white/80'} shadow-3xl backdrop-blur-3xl`}>
                  <div className="flex justify-between items-start mb-8">
                     <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h2 className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{weather.location}</h2>
                          <button onClick={() => { setActiveTab('settings'); setIsWeatherPanelPinned(false); setOverlayView(null); }} className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                            <i className="fas fa-pen text-[8px] opacity-40"></i>
                          </button>
                        </div>
                        <p className="text-xs font-bold opacity-40 uppercase tracking-widest mt-1">{weather.condition}</p>
                     </div>
                     <div className="text-right">
                        <span className="text-6xl font-black tracking-tighter" style={{color: 'var(--accent-color)'}}>{weather.temp}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                     {[
                       { label: '风速', value: weather.windSpeed, icon: 'fa-wind' },
                       { label: '湿度', value: weather.humidity, icon: 'fa-droplet' },
                       { label: '紫外线', value: weather.uvIndex, icon: 'fa-sun' },
                       { label: '空气质量', value: weather.aqi, icon: 'fa-leaf' },
                       { label: '能见度', value: weather.visibility, icon: 'fa-eye' },
                       { label: '日出/日落', value: `${weather.sunrise}/${weather.sunset}`, icon: 'fa-mountain-sun' }
                     ].map((item, i) => (
                       <div key={i} className="bg-black/5 p-4 rounded-3xl flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                             <i className={`fas ${item.icon} opacity-40`}></i>
                          </div>
                          <div>
                             <p className="text-[8px] font-black uppercase tracking-widest opacity-20">{item.label}</p>
                             <p className="text-[11px] font-bold">{item.value}</p>
                          </div>
                       </div>
                     ))}
                  </div>

                  {/* 5-Day Forecast Enhancement */}
                  {weather.dailyForecast && weather.dailyForecast.length > 0 && (
                    <div className="mb-8">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mb-5">未来 5 日预报</h3>
                       <div className="space-y-3">
                          {weather.dailyForecast.map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-black/5 rounded-[24px]">
                               <span className="text-[11px] font-black w-20">{d.date}</span>
                               <div className="flex items-center gap-3">
                                 <i className={`fas ${weatherIcons[d.condition] || 'fa-cloud'} text-xs`} style={{color: 'var(--accent-color)'}}></i>
                                 <span className="text-[9px] font-bold opacity-40 w-16">{d.condition}</span>
                               </div>
                               <div className="flex gap-2 text-[11px] font-black">
                                  <span>{d.maxTemp}</span>
                                  <span className="opacity-20">{d.minTemp}</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}

                  {weather.forecast && weather.forecast.length > 0 && (
                    <div className="mt-8">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mb-5">逐小时预报</h3>
                       <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar no-scrollbar">
                          {weather.forecast.map((h, i) => (
                            <div key={i} className="flex flex-col items-center min-w-[60px] p-4 bg-black/5 rounded-[24px]">
                               <span className="text-[10px] font-bold opacity-40 mb-2">{h.time}</span>
                               <i className={`fas ${weatherIcons[h.condition] || 'fa-cloud'} text-xs mb-2`} style={{color: 'var(--accent-color)'}}></i>
                               <span className="text-xs font-black">{h.temp}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={fetchWeatherNow} 
                      className="flex-1 py-4 rounded-2xl bg-black/5 hover:bg-black/10 transition-all text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center justify-center gap-2"
                    >
                      <i className={`fas fa-arrows-rotate ${isWeatherLoading ? 'animate-spin' : ''}`}></i>
                      刷新
                    </button>
                    <button 
                      onClick={() => { setIsWeatherPanelPinned(false); setOverlayView(null); }} 
                      className="px-6 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                      关闭
                    </button>
                  </div>
               </div>
            </div>
          )}

          <div className="px-12 pt-4 pb-2">
             <div className="flex justify-between items-end">
                <div>
                  <h1 className={`text-8xl font-black font-mono-premium tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {currentTime.getHours()}<span className="opacity-10">:</span>{currentTime.getMinutes().toString().padStart(2,'0')}
                  </h1>
                  <div className="flex items-center gap-3 mt-3 ml-1">
                    <p className={`text-[11px] font-black opacity-30 uppercase tracking-[0.4em]`}>{getLunarDate(currentTime)}</p>
                  </div>
                </div>
                <button onClick={() => setIsExpanded(false)} className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 mb-2">
                  <i className="fas fa-chevron-down text-xs"></i>
                </button>
             </div>
          </div>

          <div className="px-10 py-6">
             <div className={`px-2 py-2 rounded-[32px] flex items-center justify-between border glass-border ${isDark ? 'bg-white/5' : 'bg-black/5 shadow-inner'}`}>
                {[
                  {id: 'tasks', icon: 'fa-list-check'}, {id: 'calendar', icon: 'fa-calendar-days'},
                  {id: 'notes', icon: 'fa-feather-pointed'}, {id: 'alarms', icon: 'fa-stopwatch'}, {id: 'music', icon: 'fa-compact-disc'}
                ].map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id as TabId); setOverlayView(null); setIsWeatherPanelPinned(false); }} className={`relative w-14 h-14 rounded-[24px] transition-all duration-500 ${activeTab === item.id ? 'bg-white shadow-2xl scale-110 active-tab-glow' : 'opacity-20 hover:opacity-100 hover:scale-105'}`}>
                    <i className={`fas ${item.icon} text-[15px]`} style={{ color: activeTab === item.id ? settings.accentColor : '' }}></i>
                  </button>
                ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-4 custom-scrollbar relative pointer-events-auto">
            {activeTab === 'tasks' && (
              <div className="space-y-8 pb-32">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">智能议程</h3>
                    <button onClick={handleOpenTaskModal} className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-all"><i className="fas fa-plus text-xs"></i></button>
                 </div>

                 <div className={`p-8 rounded-[44px] border glass-border ${isDark ? 'bg-white/5' : 'bg-white shadow-md'} relative overflow-hidden group mb-10`}>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mb-5" style={{ color: 'var(--accent-color)' }}>智能议程分析</h3>
                    <p className={`text-[14px] font-medium leading-relaxed italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>"{aiSummary || '正在编排您的高效日历...'}"</p>
                 </div>

                 <div className="space-y-3 px-1">
                    {tasks.filter(t => t.date === selectedDate.toISOString().split('T')[0]).length > 0 ? tasks.filter(t => t.date === selectedDate.toISOString().split('T')[0]).map(task => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        isDark={isDark} 
                        onToggle={id => setTasks(tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t))} 
                        onDelete={id => setTasks(tasks.filter(t => t.id !== id))} 
                        onDragStart={()=>{}} onDrop={()=>{}} 
                      />
                    )) : (
                      <div className="py-20 flex flex-col items-center opacity-10">
                         <i className="fas fa-calendar-check text-6xl mb-4"></i>
                         <p className="text-[10px] font-black uppercase tracking-widest">今日暂无安排</p>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="space-y-8 pb-32">
                 {/* Calendar Grid */}
                 <div className="grid grid-cols-7 gap-3 mb-10">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                      <span key={d} className="text-center text-[8px] font-black opacity-10 tracking-[0.2em]">{d}</span>
                    ))}
                    {calendarDays.map((day, idx) => (
                      <div key={idx} onClick={() => setSelectedDate(day.date)} className={`relative aspect-square flex flex-col items-center justify-center rounded-[20px] cursor-pointer hover:scale-110 active:scale-95 transition-all group ${day.isCurrentMonth ? '' : 'opacity-5'}`}
                           style={day.isToday ? {backgroundColor: 'var(--accent-color)', color: 'white', boxShadow: '0 10px 30px rgba(var(--accent-color-rgb), 0.3)', transform: 'scale(1.1)', zIndex: 10} : (day.date.toDateString() === selectedDate.toDateString() ? {backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)', border: '2px solid var(--accent-color)'} : {})}>
                        <span className="text-[14px] font-black">{day.date.getDate()}</span>
                        <span className="text-[7px] opacity-40 font-bold tracking-tight">{day.festival || day.lunarDate}</span>
                        {day.tasks.length > 0 && <div className="absolute bottom-1.5 w-1 h-1 rounded-full" style={{backgroundColor: 'var(--accent-color)'}}></div>}
                      </div>
                    ))}
                 </div>

                 {/* Day Detail Panel */}
                 <div className={`p-8 rounded-[44px] border glass-border ${isDark ? 'bg-white/5' : 'bg-white shadow-xl'} animate-in slide-in-from-bottom-6 duration-700`}>
                    <div className="flex justify-between items-start mb-6">
                       <div>
                          <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                          </h3>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-1">
                            {getLunarDate(selectedDate)} · {getSolarFestival(selectedDate) || '常规工作日'}
                          </p>
                       </div>
                       <div className="bg-black/5 px-4 py-2 rounded-2xl">
                          <span className="text-[10px] font-black opacity-40 uppercase tracking-tighter">当日聚焦</span>
                       </div>
                    </div>

                    {/* Almanac Yi/Ji */}
                    {dayAlmanac ? (
                      <div className="space-y-6 mb-8">
                         {dayAlmanac.summary && (
                            <p className="text-[13px] font-medium italic opacity-60 border-l-2 pl-4 py-1" style={{ borderColor: 'var(--accent-color)' }}>
                               "{dayAlmanac.summary}"
                            </p>
                         )}
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50/30 p-4 rounded-3xl border border-emerald-100/20">
                               <div className="flex items-center gap-2 mb-3">
                                  <i className="fas fa-circle-check text-emerald-500 text-[10px]"></i>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">宜事项</span>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                  {dayAlmanac.yi.map((item, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-lg">{item}</span>
                                  ))}
                               </div>
                            </div>
                            <div className="bg-rose-50/30 p-4 rounded-3xl border border-rose-100/20">
                               <div className="flex items-center gap-2 mb-3">
                                  <i className="fas fa-circle-xmark text-rose-500 text-[10px]"></i>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">忌事项</span>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                  {dayAlmanac.ji.map((item, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-rose-500 text-white text-[9px] font-black rounded-lg">{item}</span>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="py-6 animate-pulse bg-black/5 rounded-3xl mb-8"></div>
                    )}

                    {/* Selected Day Agenda */}
                    <div className="pt-6 border-t glass-border">
                       <h4 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-4">当日日程安排</h4>
                       <div className="space-y-2">
                          {selectedDayTasks.length > 0 ? selectedDayTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-3 bg-black/5 rounded-2xl border border-transparent hover:border-black/5 transition-all">
                               <div className={`w-1.5 h-1.5 rounded-full ${task.completed ? 'opacity-20' : ''}`} style={{ backgroundColor: 'var(--accent-color)' }}></div>
                               <span className={`text-[11px] font-bold flex-1 ${task.completed ? 'line-through opacity-30' : ''}`}>{task.title}</span>
                               <span className="text-[9px] font-black opacity-30">{task.time}</span>
                            </div>
                          )) : (
                            <div className="py-4 text-center opacity-20">
                               <p className="text-[9px] font-black uppercase tracking-widest">暂无议程</p>
                            </div>
                          )}
                       </div>
                       <button onClick={handleOpenTaskModal} className="w-full mt-6 py-4 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all">
                          在该日期规划新任务
                       </button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-8 pb-16">
                 <div className="flex gap-4 items-center px-2">
                    <div className="relative flex-1">
                      <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[10px] opacity-20"></i>
                      <input type="text" placeholder="搜索便签..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} className="w-full bg-black/5 rounded-full py-3.5 pl-10 pr-4 text-[11px] font-bold outline-none border border-transparent focus:border-indigo-500/20 transition-all" />
                    </div>
                    <button onClick={() => setShowNoteModal(true)} className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-all"><i className="fas fa-plus text-xs"></i></button>
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                    {filteredNotes.map(note => (
                      <NoteItem key={note.id} note={note} onDelete={id => setNotes(notes.filter(n => n.id !== id))} onPin={id => setNotes(notes.map(n => n.id === id ? {...n, isPinned: !n.isPinned} : n))} />
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'alarms' && (
              <div className="space-y-8 pb-32">
                 <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">唤醒中心</h3>
                      {alarms.length > 0 && (
                        <button 
                          onClick={() => {
                            setIsAlarmSelectMode(!isAlarmSelectMode);
                            setSelectedAlarmIds(new Set());
                          }} 
                          className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all`}
                          style={isAlarmSelectMode ? {backgroundColor: 'var(--accent-color)', color: 'white'} : {color: 'var(--accent-color)', backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)'}}
                        >
                          {isAlarmSelectMode ? '完成' : '选择'}
                        </button>
                      )}
                      {alarms.length > 0 && isAlarmSelectMode && selectedAlarmIds.size > 0 && (
                        <button onClick={deleteSelectedAlarms} className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:underline transition-opacity">删除选中({selectedAlarmIds.size})</button>
                      )}
                    </div>
                    <button onClick={() => setShowAlarmModal(true)} className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-all"><i className="fas fa-plus text-xs"></i></button>
                 </div>
                 <div className="space-y-5">
                    {alarms.length > 0 ? alarms.map(alarm => (
                      <AlarmCard 
                        key={alarm.id} 
                        alarm={alarm} 
                        isSelectMode={isAlarmSelectMode}
                        isSelected={selectedAlarmIds.has(alarm.id)}
                        onSelect={() => toggleAlarmSelection(alarm.id)}
                        onToggle={id => setAlarms(alarms.map(a => a.id === id ? {...a, isActive: !a.isActive} : a))} 
                        onDelete={id => setAlarms(alarms.filter(a => !selectedAlarmIds.has(a.id)))} 
                      />
                    )) : (
                      <div className="py-20 flex flex-col items-center opacity-10">
                         <i className="fas fa-stopwatch text-6xl mb-4"></i>
                         <p className="text-[10px] font-black uppercase tracking-widest">目前没有活跃的提醒</p>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {activeTab === 'music' && (
              <div className="space-y-8 pb-16 flex flex-col h-full">
                <div className={`p-10 rounded-[56px] border glass-border transition-all duration-700 ${isDark ? 'bg-white/5' : 'bg-white shadow-2xl'} flex-1 flex flex-col`}>
                  <div className="relative mb-8">
                     <input type="text" placeholder="发现极致旋律..." value={musicSearch} onChange={e => setMusicSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchMusic(musicSearch).then(t => t && handleMusicPlay(t))} className={`w-full bg-transparent border-b-2 glass-border py-4 text-center text-sm font-black outline-none tracking-[0.2em] focus:border-indigo-500 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`} />
                  </div>
                  {currentTrack ? (
                    <div className="flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-700 overflow-hidden">
                      <div className="flex items-center gap-10 mb-6">
                         <div className="relative">
                            <img src={currentTrack.cover} className={`w-28 h-28 rounded-[36px] shadow-3xl object-cover border-4 border-white/20 transition-all ${isPlaying ? 'scale-105 shadow-indigo-500/20' : 'scale-100 opacity-60 grayscale-[0.5]'}`} />
                            {isPlaying && <div className="absolute -inset-1 rounded-[40px] border-2 border-indigo-500/30 animate-pulse"></div>}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                               <h3 className={`text-xl font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentTrack.title}</h3>
                            </div>
                            <p className="text-[10px] font-black opacity-20 tracking-[0.3em] uppercase">{currentTrack.artist}</p>
                            <div className="mt-4 flex items-center gap-3">
                               <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${isPlaying ? 'bg-indigo-500 text-white' : 'bg-black/10 opacity-30'}`}>
                                  {isPlaying ? '正在播放' : '已暂停'}
                               </span>
                            </div>
                            <div className="mt-6"><AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} color={settings.accentColor} /></div>
                         </div>
                      </div>

                      {/* Lyrics Section */}
                      <div className="flex-1 relative mb-6 overflow-hidden bg-black/5 rounded-[32px] px-6">
                        <div 
                          ref={lyricsContainerRef}
                          className="h-full overflow-y-auto custom-scrollbar no-scrollbar flex flex-col items-center py-10"
                        >
                          {isLyricsLoading ? (
                            <div className="flex flex-col items-center gap-4 opacity-20 animate-pulse py-10">
                              <i className="fas fa-feather text-2xl"></i>
                              <p className="text-[10px] font-black uppercase tracking-widest">提取旋律中的词章...</p>
                            </div>
                          ) : lyrics.length > 0 ? (
                            lyrics.map((line, idx) => (
                              <p 
                                key={idx} 
                                className={`text-center py-2 transition-all duration-500 px-6 ${
                                  idx === activeLyricIndex 
                                    ? 'text-base font-black scale-110 opacity-100' 
                                    : 'text-xs font-bold opacity-20'
                                }`}
                                style={{ color: idx === activeLyricIndex ? 'var(--accent-color)' : '' }}
                              >
                                {line.text}
                              </p>
                            ))
                          ) : (
                            <div className="flex flex-col items-center gap-4 opacity-10 py-10">
                              <i className="fas fa-comment-slash text-2xl"></i>
                              <p className="text-[10px] font-black uppercase tracking-widest">未找到歌词</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-6 space-y-6">
                         <div className="space-y-2">
                            <input type="range" min="0" max={musicDuration || 0} value={musicCurrentTime} onChange={handleSeek} className="w-full h-1.5 accent-indigo-500 bg-black/5 rounded-full appearance-none cursor-pointer" />
                            <div className="flex justify-between text-[9px] font-black opacity-30 tracking-widest">
                               <span>{formatTime(musicCurrentTime)}</span>
                               <span>{formatTime(musicDuration)}</span>
                            </div>
                         </div>
                         <div className="flex justify-center items-center gap-12 py-4">
                            <button className="w-20 h-20 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 transition-all" onClick={() => { if(audioPlayerRef.current) isPlaying ? audioPlayerRef.current.pause() : audioPlayerRef.current.play(); setIsPlaying(!isPlaying); }}>
                               <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-2xl`}></i>
                            </button>
                         </div>
                      </div>
                    </div>
                  ) : <div className="flex-1 flex flex-col items-center justify-center opacity-10 grayscale"><i className="fas fa-compact-disc text-8xl animate-spin-slow"></i></div>}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-12 pb-24 animate-in slide-in-from-right duration-500 px-2">
                <section className="space-y-5">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30" style={{ color: 'var(--accent-color)' }}>地理与本地化</h3>
                   <div className="p-8 rounded-[40px] bg-black/5 border glass-border space-y-6">
                      <div className="space-y-3">
                         <label className="text-[9px] font-black uppercase tracking-widest opacity-40">当前城市 (自定义设置)</label>
                         <div className="relative group">
                           <i className="fas fa-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-xs opacity-20"></i>
                           <input 
                             type="text" 
                             value={settings.manualLocation} 
                             onChange={e => setSettings({...settings, manualLocation: e.target.value})} 
                             onBlur={fetchWeatherNow}
                             onKeyDown={e => e.key === 'Enter' && fetchWeatherNow()}
                             className={`w-full bg-white/5 py-4 pl-12 pr-6 rounded-2xl text-xs font-bold outline-none border border-transparent transition-all ${isDark ? 'text-white' : 'text-slate-900'}`} 
                             style={{borderBottom: '2px solid rgba(var(--accent-color-rgb), 0.1)'}}
                             placeholder="输入城市名称，如：上海"
                           />
                         </div>
                         <p className="text-[7px] font-bold opacity-20 px-2 uppercase tracking-tighter">输入城市并按回车，系统将立即同步最新气象数据。</p>
                      </div>
                   </div>
                </section>

                <section className="space-y-5">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30" style={{ color: 'var(--accent-color)' }}>视觉引擎</h3>
                   <div className="p-8 rounded-[40px] bg-black/5 border glass-border space-y-8">
                      <div className="flex justify-between items-center">
                         <label className="text-[9px] font-black uppercase tracking-widest opacity-40">全局深色模式</label>
                         <button onClick={() => setSettings({...settings, theme: isDark ? 'light' : 'dark'})} className={`w-14 h-7 rounded-full relative transition-all duration-500 ${isDark ? 'shadow-lg' : 'bg-slate-300'}`} style={isDark ? {backgroundColor: 'var(--accent-color)'} : {}}>
                            <div className={`absolute w-5 h-5 bg-white rounded-full top-1 shadow-md transition-all duration-500 ${isDark ? 'left-8' : 'left-1'}`}></div>
                         </button>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[9px] font-black uppercase tracking-widest opacity-40">全局强调色</label>
                         <div className="flex gap-3 flex-wrap">
                            {ACCENT_PRESETS.map(color => (
                              <button key={color} onClick={() => setSettings({...settings, accentColor: color})} className={`w-10 h-10 rounded-2xl transition-all duration-300 ${settings.accentColor === color ? 'ring-4 ring-white shadow-xl scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: color }}></button>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex justify-between">
                           <label className="text-[9px] font-black uppercase tracking-widest opacity-40">透明度</label>
                           <span className="text-[10px] font-black">{settings.glassOpacity}%</span>
                         </div>
                         <input type="range" min="20" max="100" value={settings.glassOpacity} onChange={e => setSettings({...settings, glassOpacity: parseInt(e.target.value)})} className="w-full h-1 rounded-full appearance-none bg-black/10 cursor-pointer" style={{accentColor: 'var(--accent-color)'}} />
                      </div>

                      <div className="space-y-4">
                         <div className="flex justify-between">
                           <label className="text-[9px] font-black uppercase tracking-widest opacity-40">模糊度</label>
                           <span className="text-[10px] font-black">{settings.glassBlur}px</span>
                         </div>
                         <input type="range" min="0" max="80" value={settings.glassBlur} onChange={e => setSettings({...settings, glassBlur: parseInt(e.target.value)})} className="w-full h-1 rounded-full appearance-none bg-black/10 cursor-pointer" style={{accentColor: 'var(--accent-color)'}} />
                      </div>
                   </div>
                </section>
              </div>
            )}
          </div>
          
          <div className="h-10 border-t glass-border bg-black/5 flex items-center relative overflow-hidden shrink-0">
             <div className="flex whitespace-nowrap animate-ticker items-center h-full">
                {news.map((item, idx) => (
                  <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-10 border-r glass-border hover:bg-black/10 transition-colors">
                     <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded" style={{color: 'var(--accent-color)'}}>{item.source}</span>
                     <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.title}</span>
                  </a>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-8 animate-in zoom-in-95 duration-500">
           <div className={`rounded-[64px] p-12 w-full max-w-sm shadow-3xl border glass-border ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={glassStyle}>
              <h2 className="text-xs font-black uppercase tracking-[0.6em] opacity-30 mb-10 text-center" style={{color: 'var(--accent-color)'}}>规划新任务</h2>
              
              <div className="space-y-8">
                <input type="text" placeholder="任务名称..." value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className={`w-full bg-transparent border-b-2 glass-border py-4 text-2xl font-black outline-none transition-all ${isDark ? 'text-white' : 'text-slate-900'}`} style={{borderBottomColor: 'rgba(var(--accent-color-rgb), 0.2)'}} />
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                     <span className="text-[10px] font-black uppercase tracking-widest opacity-30">计划日期</span>
                     <input 
                       type="date" 
                       value={newTask.date} 
                       onChange={e => setNewTask({...newTask, date: e.target.value})} 
                       className={`bg-black/5 px-4 py-2 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-white/10 ${isDark ? 'text-white' : 'text-slate-900'}`} 
                     />
                  </div>

                  <div className="flex justify-between items-center px-1">
                     <span className="text-[10px] font-black uppercase tracking-widest opacity-30">计划时间</span>
                     <input 
                       type="time" 
                       value={newTask.time} 
                       onChange={e => setNewTask({...newTask, time: e.target.value})} 
                       className={`bg-black/5 px-4 py-2 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-white/10 ${isDark ? 'text-white' : 'text-slate-900'}`} 
                     />
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-30 px-1">任务类别</span>
                  <div className="grid grid-cols-2 gap-3">
                    {['work', 'personal', 'urgent', 'other'].map(cat => (
                      <button key={cat} onClick={() => setNewTask({...newTask, category: cat as any})} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${newTask.category === cat ? 'text-white' : 'bg-black/5 opacity-40 hover:opacity-100'}`} style={newTask.category === cat ? {backgroundColor: 'var(--accent-color)'} : {}}>{cat}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 mt-12">
                 <button onClick={() => setShowTaskModal(false)} className="flex-1 py-5 text-[11px] font-black opacity-30 tracking-widest uppercase">舍弃</button>
                 <button onClick={handleAddTask} className="flex-2 py-5 bg-slate-900 text-white rounded-[28px] text-[11px] font-black uppercase shadow-3xl hover:scale-105 active:scale-95 transition-all">确认安排</button>
              </div>
           </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-8 animate-in zoom-in-95 duration-500">
           <div className={`rounded-[64px] p-12 w-full max-w-sm shadow-3xl border glass-border ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={glassStyle}>
              <h2 className="text-xs font-black uppercase tracking-[0.6em] opacity-30 mb-8 text-center" style={{color: 'var(--accent-color)'}}>记事与灵感</h2>
              <textarea placeholder="在这里记录你的突发奇想..." value={newNote.content} onChange={e => setNewNote({...newNote, content: e.target.value})} className={`w-full bg-transparent border-b-2 glass-border py-4 text-lg font-bold outline-none mb-10 min-h-[150px] resize-none transition-all ${isDark ? 'text-white' : 'text-slate-900'}`} style={{borderBottomColor: 'rgba(var(--accent-color-rgb), 0.2)'}} />
              <div className="flex gap-6">
                 <button onClick={() => setShowNoteModal(false)} className="flex-1 py-5 text-[11px] font-black opacity-30 tracking-widest uppercase">舍弃</button>
                 <button onClick={handleAddNote} className="flex-2 py-5 bg-slate-900 text-white rounded-[28px] text-[11px] font-black uppercase shadow-3xl hover:scale-105 active:scale-95 transition-all">保存灵感</button>
              </div>
           </div>
        </div>
      )}

      {/* Alarm Modal */}
      {showAlarmModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-8 animate-in zoom-in-95 duration-500">
           <div className={`rounded-[64px] p-12 w-full max-w-sm shadow-3xl border glass-border ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={glassStyle}>
              <h2 className="text-xs font-black uppercase tracking-[0.6em] opacity-30 mb-8 text-center" style={{color: 'var(--accent-color)'}}>配置新闹钟</h2>
              
              <div className="space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">
                <div className="relative group">
                  <input type="time" value={newAlarm.time} onChange={e => setNewAlarm({...newAlarm, time: e.target.value})} className={`w-full bg-transparent border-b-2 glass-border py-8 text-7xl font-black font-mono-premium text-center outline-none transition-all ${isDark ? 'text-white' : 'text-slate-900'}`} style={{borderBottomColor: 'rgba(var(--accent-color-rgb), 0.2)'}} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-[9px] font-black uppercase tracking-widest opacity-20 px-2">闹钟标记</h4>
                  <input 
                    type="text" 
                    placeholder="例如：早起运动..." 
                    value={newAlarm.label} 
                    onChange={e => setNewAlarm({...newAlarm, label: e.target.value})} 
                    className={`w-full bg-black/5 py-4 px-6 rounded-2xl text-xs font-bold outline-none border border-transparent transition-all ${isDark ? 'text-white' : 'text-slate-900'}`} 
                  />
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[9px] font-black uppercase tracking-widest opacity-20 px-2">重复周期</h4>
                  <div className="flex justify-between">
                    {['日','一','二','三','四','五','六'].map((d, i) => (
                      <button key={i} onClick={() => toggleDayInNewAlarm(i)} className={`w-9 h-9 rounded-2xl text-[10px] font-black transition-all ${newAlarm.days?.includes(i) ? 'text-white shadow-xl scale-110' : 'bg-black/5 opacity-40 hover:opacity-100'}`} style={newAlarm.days?.includes(i) ? {backgroundColor: 'var(--accent-color)'} : {}}>{d}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest opacity-20">铃声矩阵</h4>
                    <button onClick={() => fileInputRef.current?.click()} className="text-[8px] font-black uppercase tracking-widest hover:underline transition-all" style={{color: 'var(--accent-color)'}}>
                       <i className="fas fa-cloud-arrow-up mr-1"></i>自定义
                    </button>
                    <input type="file" ref={fileInputRef} hidden accept="audio/*" onChange={handleFileUpload} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(RINGTOWN_SOUNDS).map(([key, data]) => (
                      <button 
                        key={key} 
                        onClick={() => setNewAlarm({...newAlarm, ringtone: key as any, ringtoneUrl: undefined})} 
                        className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newAlarm.ringtone === key ? 'bg-white shadow-md scale-[1.02]' : 'bg-black/5 border-transparent opacity-60 hover:opacity-100'}`}
                        style={newAlarm.ringtone === key ? {borderColor: 'var(--accent-color)'} : {}}
                      >
                        <i className={`fas ${data.icon} text-[10px]`} style={newAlarm.ringtone === key ? {color: 'var(--accent-color)'} : {}}></i>
                        <span className="text-[10px] font-black truncate">{data.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 mt-10 pt-6 border-t glass-border">
                 <button onClick={() => setShowAlarmModal(false)} className="flex-1 py-5 text-[11px] font-black opacity-30 tracking-widest uppercase hover:opacity-100 transition-opacity">舍弃</button>
                 <button onClick={() => { setAlarms([{id: crypto.randomUUID(), ...newAlarm as Alarm, isActive: true}, ...alarms]); setShowAlarmModal(false); }} className="flex-[2] py-5 bg-slate-900 text-white rounded-[28px] text-[11px] font-black uppercase shadow-3xl hover:scale-105 active:scale-95 transition-all">创建闹钟</button>
              </div>
           </div>
        </div>
      )}

      {ringingAlarm && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-slate-950/98 text-white p-12 animate-in fade-in duration-700 backdrop-blur-3xl">
           <div className="absolute inset-0 mesh-gradient opacity-60 blur-[120px]"></div>
           <div className="relative z-10 flex flex-col items-center">
             <div className="w-24 h-24 rounded-full flex items-center justify-center animate-bounce mb-12 shadow-[0_0_50px_rgba(var(--accent-color-rgb),0.5)]" style={{backgroundColor: 'var(--accent-color)'}}><i className="fas fa-bell text-3xl"></i></div>
             <h3 className="text-[2.5rem] font-black uppercase tracking-[0.5em] text-center mb-4 animate-pulse">{ringingAlarm.label || 'Lumina 唤醒提醒'}</h3>
             <h2 className="text-[14rem] font-black font-mono-premium tracking-tighter leading-none mb-4">{ringingAlarm.time}</h2>
             <div className="flex gap-8">
                <button onClick={handleSnooze} className="px-16 py-7 bg-white/10 border glass-border rounded-[32px] font-black text-sm uppercase tracking-widest hover:bg-white/20 transition-all group">
                   <span className="group-hover:scale-110 transition-transform inline-block">稍后 (9分)</span>
                </button>
                <button onClick={() => { setRingingAlarm(null); alarmAudioRef.current?.pause(); }} className="px-16 py-7 bg-white text-slate-950 rounded-[32px] font-black text-sm uppercase tracking-widest shadow-3xl hover:scale-105 active:scale-95 transition-all">立即关闭</button>
             </div>
           </div>
        </div>
      )}

      <audio ref={audioPlayerRef} onTimeUpdate={() => audioPlayerRef.current && setMusicCurrentTime(audioPlayerRef.current.currentTime)} onLoadedMetadata={() => audioPlayerRef.current && setMusicDuration(audioPlayerRef.current.duration)} onEnded={() => setIsPlaying(false)} />
      <audio ref={alarmAudioRef} loop />
    </div>
  );
};

export default App;
