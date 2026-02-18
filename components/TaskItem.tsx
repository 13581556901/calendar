
import React, { useState } from 'react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, targetTaskId: string) => void;
  isDark?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, onDragStart, onDrop, isDark }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e, task.id); }}
      className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 border-2 ${
        isDragOver ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]' : 'border-transparent hover:bg-white/10 hover:shadow-lg'
      } ${task.completed ? 'opacity-40 grayscale-[0.5]' : ''}`}
    >
      <button 
        onClick={() => onToggle(task.id)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${task.completed ? 'border-transparent scale-90' : 'border-slate-200 hover:border-indigo-400'}`}
        style={task.completed ? {backgroundColor: 'var(--accent-color)'} : {}}
      >
        {task.completed && <i className="fas fa-check text-[10px] text-white"></i>}
      </button>
      
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-bold truncate transition-all duration-500 ${task.completed ? 'line-through text-slate-400' : (isDark ? 'text-slate-100' : 'text-slate-800')}`}>
          {task.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-tighter border transition-colors duration-500 ${
            task.category === 'urgent' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-100'
          }`}>
            {task.category}
          </span>
          {task.time && <span className={`text-[8px] font-bold flex items-center gap-1 transition-colors duration-500 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><i className="far fa-clock"></i>{task.time}</span>}
        </div>
      </div>

      <button 
        onClick={() => onDelete(task.id)}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all duration-300"
      >
        <i className="fas fa-trash-can text-[10px]"></i>
      </button>
    </div>
  );
};

export default TaskItem;
