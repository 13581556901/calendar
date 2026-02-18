
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isPlaying, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 3;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `${color}33`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = barWidth / 2;
        // Draw bars with rounded tops
        if (barHeight > 2) {
            ctx.roundRect(x, canvas.height - barHeight, barWidth - 1, barHeight, [radius, radius, 0, 0]);
            ctx.fill();
            
            // Subtle glow effect for higher peaks
            if (barHeight > canvas.height * 0.7) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
            } else {
                ctx.shadowBlur = 0;
            }
        }

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={50} 
      className="w-full h-12 opacity-90 theme-transition"
    />
  );
};

export default AudioVisualizer;
