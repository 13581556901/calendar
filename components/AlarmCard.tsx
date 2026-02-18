
import React from 'react';
import { Alarm } from '../types';

interface AlarmCardProps {
  alarm: Alarm;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const RINGTOWN_SOUNDS: Record<string, { label: string; icon: string }> = {
  classic: { label: '经典铃声', icon: 'fa-bell' },
  digital: { label: '电子脉冲', icon: 'fa-microchip' },
  zen: { label: '禅意晨鸣', icon: 'fa-leaf' },
  urgent: { label: '紧急突发', icon: 'fa-triangle-exclamation' }
};

const AlarmCard: React.FC<AlarmCardProps> = ({ alarm, onToggle, onDelete, isSelectMode, isSelected, onSelect }) => {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const currentSound = alarm.ringtone === 'custom' 
    ? { label: alarm.ringtoneName || '自定义铃声', icon: 'fa-file-audio' }
    : RINGTOWN_SOUNDS[alarm.ringtone || 'classic'];

  return (
    <div 
      onClick={isSelectMode ? onSelect : undefined}
      className={`p-6 rounded-[36px] mb-4 transition-all duration-700 border-2 relative overflow-hidden flex items-center gap-4 ${isSelectMode ? 'cursor-pointer' : ''} ${alarm.isActive ? 'bg-white border-indigo-100 shadow-xl shadow-indigo-100/30' : 'bg-slate-100/20 border-transparent opacity-60'} group`}
      style={isSelected ? {borderColor: 'var(--accent-color)', backgroundColor: 'rgba(var(--accent-color-rgb), 0.05)'} : {}}
    >
      {/* Selection Checkbox */}
      {isSelectMode && (
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${isSelected ? 'border-transparent scale-110 shadow-lg' : 'border-slate-300'}`}
             style={isSelected ? {backgroundColor: 'var(--accent-color)'} : {}}>
          {isSelected && <i className="fas fa-check text-[10px] text-white"></i>}
        </div>
      )}

      {alarm.isActive && !isSelectMode && (
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl animate-pulse" style={{backgroundColor: 'rgba(var(--accent-color-rgb), 0.05)'}}></div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col gap-1">
            {alarm.label && (
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 transition-colors`} style={alarm.isActive ? {color: 'var(--accent-color)'} : {color: '#94a3b8'}}>
                {alarm.label}
              </span>
            )}
            <div className="flex items-center gap-3">
               <span className={`text-4xl font-black font-mono leading-none tracking-tighter transition-colors duration-700 ${alarm.isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {alarm.time}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors duration-700`} style={alarm.isActive ? {color: 'var(--accent-color)'} : {color: '#94a3b8'}}>
                <i className={`fas ${currentSound.icon}`}></i>
                <span className="truncate max-w-[150px]">{currentSound.label}</span>
              </div>
            </div>
          </div>

          {!isSelectMode && (
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(alarm.id); }}
                className={`w-12 h-6 rounded-full relative transition-all duration-500 flex items-center ${alarm.isActive ? 'shadow-lg' : 'bg-slate-300'}`}
                style={alarm.isActive ? {backgroundColor: 'var(--accent-color)'} : {}}
              >
                <div className={`absolute w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-md ${alarm.isActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(alarm.id);
                }} 
                className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all duration-300 group/btn"
              >
                <i className="fas fa-trash-can text-[11px] group-hover/btn:scale-110 transition-transform"></i>
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 mt-5">
          {days.map((day, idx) => {
            const isSelectedDay = alarm.days.includes(idx);
            return (
              <span 
                key={idx} 
                className={`w-7 h-7 flex items-center justify-center text-[9px] rounded-xl font-black transition-all duration-700 ${
                  isSelectedDay 
                    ? alarm.isActive ? 'text-white shadow-md' : 'bg-slate-400 text-white'
                    : 'bg-black/5 text-slate-400 opacity-20'
                }`}
                style={isSelectedDay && alarm.isActive ? {backgroundColor: 'var(--accent-color)'} : {}}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AlarmCard;
