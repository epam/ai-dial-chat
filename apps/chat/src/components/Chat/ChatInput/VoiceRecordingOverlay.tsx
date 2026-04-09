import { FC, useCallback, useEffect, useRef } from 'react';

import classNames from 'classnames';

interface Props {
  analyserNode: AnalyserNode | null;
  elapsedTime: number;
  isOverlay?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceRecordingOverlay: FC<Props> = ({
  analyserNode,
  elapsedTime,
  isOverlay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = 2;
    const gap = 2;
    const barCount = Math.min(
      bufferLength,
      Math.floor(width / (barWidth + gap)),
    );

    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary')
        .trim() || '#eef1f7';

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i] / 255;
      const barHeight = Math.max(2, value * height * 0.85);

      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      ctx.globalAlpha = 0.35 + value * 0.65;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode]);

  useEffect(() => {
    if (analyserNode) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (rect) {
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
        }
      }
      animationFrameRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analyserNode, draw]);

  return (
    <div
      className={classNames(
        'absolute inset-0 z-10 flex items-end rounded bg-layer-3',
        isOverlay ? 'pb-1 pl-3 pr-10' : 'pb-1.5 pl-4 pr-11 md:pb-2',
      )}
      data-qa="voice-recording-overlay"
    >
      <div className="mb-1.5 flex shrink-0 items-center gap-2">
        <div className="size-2.5 animate-pulse rounded-full bg-[var(--text-error,#F76464)]" />
        <span className="min-w-[36px] text-sm tabular-nums text-secondary">
          {formatTime(elapsedTime)}
        </span>
      </div>

      <div className="mx-3 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ height: '32px' }}
        />
      </div>
    </div>
  );
};
