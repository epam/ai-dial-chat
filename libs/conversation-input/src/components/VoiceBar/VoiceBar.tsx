import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialErrorText,
  GhostIconButton,
  PrimaryIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconPlayerStopFilled, IconX } from '@tabler/icons-react';
import {
  type CSSProperties,
  type FC,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { VoiceRecorderState } from '../../hooks/useVoiceRecorder';
import inputStyles from '../Input/Input.module.scss';
import styles from './VoiceBar.module.scss';

const BAR_WIDTH = 3;
const BAR_GAP = 1;
const BAR_STEP = BAR_WIDTH + BAR_GAP;
const RING_SIZE = 200;

const formatTime = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Props accepted by the `VoiceBar` component. */
export interface VoiceBarProps {
  /** Current recorder state — must not be `'idle'` when this component is rendered. */
  state: VoiceRecorderState;
  /** Stable ref to the live `AnalyserNode` during recording; `.current` is `null` when idle. */
  analyserNodeRef: RefObject<AnalyserNode | null>;
  /** Elapsed recording time in whole seconds. */
  elapsedSeconds: number;
  /** Error message in `error` state; `null` otherwise. */
  errorMessage: string | null;
  /** Called when the user clicks the stop button to finish recording. */
  onStop: () => void;
  /** Called when the user clicks the X to discard the recording. */
  onDiscard: () => void;
  /** Accessible label for the stop-recording button. Defaults to `'Stop recording'`. */
  stopLabel?: string;
  /** Accessible label for the discard / cancel button. Defaults to `'Discard recording'`. */
  discardLabel?: string;
  /** Accessible label for the recording timer region. Defaults to `'Recording time'`. */
  timerLabel?: string;
  /** CSS custom properties forwarded from the parent (e.g. `--ci-bg`, `--ci-border`). */
  style?: CSSProperties;
  /** Extra class names applied to the root element. */
  className?: string;
}

/** Voice recording bar: live timer, scrolling waveform, stop and discard controls. */
export const VoiceBar: FC<VoiceBarProps> = ({
  state,
  analyserNodeRef,
  elapsedSeconds,
  errorMessage,
  onStop,
  onDiscard,
  stopLabel = 'Stop recording',
  discardLabel = 'Discard recording',
  timerLabel = 'Recording time',
  style,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringBufferRef = useRef<Float32Array>(new Float32Array(RING_SIZE));
  const writeIndexRef = useRef(0);
  /* Tracks sub-bar-width scroll offset in pixels (0 … BAR_STEP) for smooth animation. */
  const scrollPxRef = useRef(0);
  const isRecording = state === VoiceRecorderState.Recording;
  const isError = state === VoiceRecorderState.Error;

  /* Draw the ring buffer as a scrolling bar histogram spanning the full canvas width.
   * Uses scrollPxRef for sub-bar-width translation so bars slide at 1 px/frame rather
   * than jumping by a full bar width every BAR_STEP frames. */
  const drawCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.clientWidth || 200;
    canvas.height = canvas.clientHeight || 32;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barColor = getComputedStyle(canvas).color;
    ctx.fillStyle = barColor;

    /* Cap barCount so we never ask for more bars than the ring buffer holds. */
    const barCount = Math.min(
      Math.max(1, Math.floor(width / BAR_STEP)),
      RING_SIZE - 1,
    );
    const writeIndex = writeIndexRef.current;
    const offset = scrollPxRef.current;

    /* Clip to canvas bounds so the extra right-edge bar does not overflow. */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.translate(-offset, 0);

    /* Draw barCount + 1 bars: the extra bar fills the gap revealed by translation.
     * Formula: bar i maps to ring-buffer slot (writeIndex - barCount + i) mod RING_SIZE.
     * This guarantees that when writeIndex advances and offset resets, old bar(i+1)
     * shows the same slot as new bar(i) — visual continuity across the wrap boundary. */
    for (let i = 0; i <= barCount; i++) {
      const sampleIdx =
        (((writeIndex - barCount + i) % RING_SIZE) + RING_SIZE) % RING_SIZE;
      const raw = ringBufferRef.current[sampleIdx] ?? 0;
      const amplitude = Math.min(1, raw * 6);
      const barHeight = Math.max(3, amplitude * height);
      ctx.fillRect(
        i * BAR_STEP,
        (height - barHeight) / 2,
        BAR_WIDTH,
        barHeight,
      );
    }

    ctx.restore();
  }, []);

  /*
   * RAF loop: runs only during recording. Advances scrollPxRef by 1 px per frame
   * for smooth scrolling. Every BAR_STEP pixels a new RMS sample is written to the
   * ring buffer (overwriting the oldest slot). This keeps bar heights stable for
   * BAR_STEP consecutive frames and avoids per-frame flicker.
   */
  useEffect(() => {
    if (!isRecording) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Reset ring buffer and scroll offset for a fresh recording session. */
    ringBufferRef.current.fill(0);
    writeIndexRef.current = 0;
    scrollPxRef.current = 0;

    let rafId: number;

    const tick = () => {
      /* Advance sub-bar scroll offset; sample the analyser once per full bar width. */
      scrollPxRef.current += 1;
      if (scrollPxRef.current >= BAR_STEP) {
        scrollPxRef.current -= BAR_STEP;
        const analyser = analyserNodeRef.current;
        if (analyser) {
          const buf = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let j = 0; j < buf.length; j++) {
            const s = (buf[j] - 128) / 128;
            sum += s * s;
          }
          ringBufferRef.current[writeIndexRef.current % RING_SIZE] = Math.sqrt(
            sum / buf.length,
          );
          writeIndexRef.current++;
        }
      }
      drawCanvas(canvas);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isRecording, analyserNodeRef, drawCanvas]);

  /* Redraw on resize — preserves accumulated ring buffer content at the new width. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      drawCanvas(canvas);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawCanvas]);

  const controls = (
    <div className="flex flex-shrink-0 items-center justify-end gap-1">
      <GhostIconButton
        icon={<IconX size={DIAL_ICON_SIZE.LG} aria-hidden />}
        aria-label={discardLabel}
        onClick={onDiscard}
      />
      {isRecording && (
        <PrimaryIconButton
          icon={<IconPlayerStopFilled size={DIAL_ICON_SIZE.LG} />}
          onClick={() => onStop?.()}
          aria-label={stopLabel}
        />
      )}
    </div>
  );

  return (
    <div className={className}>
      <div
        style={style}
        className={mergeClasses(
          inputStyles.wrapper,
          'flex min-h-[64px] w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border px-3 shadow-md desktop:flex-row desktop:items-center desktop:gap-2 desktop:py-2',
          isError && styles.wrapperError,
        )}
      >
        {/* Row 1 on mobile / inline on desktop: timer + waveform canvas */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isRecording && (
            <>
              <span
                className={mergeClasses(
                  styles.recordingDot,
                  'pointer-events-none block size-[8px] rounded-3xl',
                )}
                aria-hidden
              />
              <span
                className={mergeClasses(styles.timer, 'flex-shrink-0')}
                aria-label={timerLabel}
              >
                {formatTime(elapsedSeconds)}
              </span>
            </>
          )}
          <canvas
            ref={canvasRef}
            height={32}
            className={mergeClasses(
              styles.waveformCanvas,
              'h-8 min-w-0 flex-1 desktop:h-6',
            )}
          />
        </div>

        {/* Row 2 on mobile / inline on desktop: state-based controls */}
        {controls}
      </div>

      {isError && errorMessage && (
        <DialErrorText text={errorMessage} className="mt-1 px-1" />
      )}
    </div>
  );
};
