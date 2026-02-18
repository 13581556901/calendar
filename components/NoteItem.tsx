
import React from 'react';
import { Note } from '../types';

interface NoteItemProps {
  note: Note;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}

const tagColors: Record<string, string> = {
  work: '#6366f1',
  idea: '#ec4899',
  life: '#10b981',
  urgent: '#f43f5e'
};

const NoteItem: React.FC<NoteItemProps> = ({ note, onDelete, onPin }) => {
  const dateStr = new Date(note.timestamp).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div 
      className={`p-6 rounded-[36px] mb-4 shadow-sm border relative group animate-in slide-in-from-bottom-2 duration-500 transition-all ${note.isPinned ? 'ring-2 ring-indigo-500' : 'border-black/5'}`}
      style={{ backgroundColor: note.isPinned ? 'rgba(255,255,255,0.05)' : note.color }}
    >
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onPin(note.id)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${note.isPinned ? 'bg-indigo-600 text-white' : 'bg-black/5 hover:bg-indigo-100 hover:text-indigo-600'}`}>
          <i className="fas fa-thumbtack text-[10px]"></i>
        </button>
        <button onClick={() => onDelete(note.id)} className="w-8 h-8 rounded-full bg-black/5 text-slate-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
          <i className="fas fa-trash-can text-[10px]"></i>
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagColors[note.tag || 'life'] }}></div>
        <span className="text-[8px] font-black uppercase tracking-widest opacity-30">{note.tag || 'life'}</span>
      </div>

      <p className={`text-[12px] font-bold leading-relaxed whitespace-pre-wrap pr-4 ${note.isPinned ? 'text-slate-200' : 'text-slate-800'}`}>
        {note.content}
      </p>
      
      <div className="mt-5 pt-4 border-t border-black/5">
        <span className={`text-[8px] font-black uppercase tracking-tighter ${note.isPinned ? 'text-indigo-400' : 'text-black/20'}`}>
          {dateStr}
        </span>
      </div>
    </div>
  );
};

export default NoteItem;
