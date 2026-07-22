import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialErrorText,
  DialGhostIconButton,
  DialSpinner,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconPlaystationSquare, IconX } from '@tabler/icons-react';
import {
  type CSSProperties,
  type FC,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { VoiceRecorderState } from '../../hooks/useVoiceRecorder';
import styles from './VoiceBar.module.scss';

const BAR_WIDTH = 3;
const BAR_GAP = 1;

const SPLASH_SECTIONS = 6;
const MIN_SPLASH_FRACTION = 0.12; // bars never collapse below this fraction of height

/** Props accepted by the `VoiceBar` component. */
export interface VoiceBarProps {
  /** Current recorder state — must not be `'idle'` when this component is rendered. */
  state: VoiceRecorderState;
  /** Accumulated RMS amplitude history. `null` before recording starts. */
  waveformData: Float32Array | null;
  /** Error message in `error` state; `null` otherwise. */
  errorMessage: string | null;
  /** Called when the user clicks the red mic button to stop recording. */
  onStop: () => void;
  /** Called when the user clicks the checkmark to confirm, or retry after an error. */
  onConfirm: () => void;
  /** Called when the user clicks the X to discard the recording or cancel uploading. */
  onDiscard: () => void;
  /** Accessible label for the stop-recording mic button. Defaults to `'Stop recording'`. */
  stopLabel?: string;
  /** Accessible label for the confirm / retry button. Defaults to `'Send voice message'`. */
  confirmLabel?: string;
  /** Accessible label for the discard / cancel button. Defaults to `'Discard recording'`. */
  discardLabel?: string;
  /** Accessible label for the uploading progress indicator. Defaults to `'Uploading…'`. */
  uploadingLabel?: string;
  /** CSS custom properties forwarded from the parent (e.g. `--ci-bg`, `--ci-border`). */
  style?: CSSProperties;
  /** Extra class names applied to the root element. */
  className?: string;
}

/**
 * Renders the voice recording bar: waveform canvas, state-based controls,
 * and an error text for the `error` state. Replaces the `Input` component
 * while voice state is not `idle`.
 */
export const VoiceBar: FC<VoiceBarProps> = ({
  state,
  waveformData,
  errorMessage,
  onStop,
  onConfirm,
  onDiscard,
  stopLabel = 'Stop recording',
  confirmLabel = 'Send voice message',
  discardLabel = 'Discard recording',
  uploadingLabel = 'Uploading…',
  style,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const isRecordingRef = useRef(false);
  const isRecording = state === VoiceRecorderState.Recording;
  const isUploading = state === VoiceRecorderState.Uploading;
  const isError = state === VoiceRecorderState.Error;

  // Keep a ref so draw callbacks always see the latest recording state
  isRecordingRef.current = isRecording;

  /** Draw live splash animation: SPLASH_SECTIONS arch-shaped groups filling the full
   *  canvas width, each scaled by the current RMS amplitude. */
  const drawSplash = useCallback(
    (canvas: HTMLCanvasElement, currentRms: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.clientWidth || 200;
      canvas.height = canvas.clientHeight || 32;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barColor = getComputedStyle(canvas).color;
      ctx.fillStyle = barColor;

      // Scale: RMS ~0.03-0.15 → 0.18-0.9 after ×6
      const amplitude = Math.min(1, currentRms * 6);
      const barCount = Math.max(1, Math.floor(width / (BAR_WIDTH + BAR_GAP)));

      for (let i = 0; i < barCount; i++) {
        // |sin| over SPLASH_SECTIONS half-periods → SPLASH_SECTIONS humps
        const t = (i / barCount) * SPLASH_SECTIONS * Math.PI;
        const envelope = Math.abs(Math.sin(t));
        const fraction = Math.max(MIN_SPLASH_FRACTION, envelope * amplitude);
        const barHeight = Math.max(3, fraction * height);
        ctx.fillRect(
          i * (BAR_WIDTH + BAR_GAP),
          (height - barHeight) / 2,
          BAR_WIDTH,
          barHeight,
        );
      }
    },
    [],
  );

  /** Draw the frozen history histogram after recording stops. */
  const drawWaveform = useCallback(
    (canvas: HTMLCanvasElement, data: Float32Array | null) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.clientWidth || 200;
      canvas.height = canvas.clientHeight || 32;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (!data || data.length === 0) return;

      const barColor = getComputedStyle(canvas).color;
      ctx.fillStyle = barColor;

      const barCount = Math.max(1, Math.floor(width / (BAR_WIDTH + BAR_GAP)));

      for (let i = 0; i < barCount; i++) {
        const sampleIndex = Math.floor((i / barCount) * data.length);
        const raw = data[sampleIndex] ?? 0;
        const amplitude = Math.min(1, raw * 6);
        const barHeight = Math.max(3, amplitude * height);
        ctx.fillRect(
          i * (BAR_WIDTH + BAR_GAP),
          (height - barHeight) / 2,
          BAR_WIDTH,
          barHeight,
        );
      }
    },
    [],
  );

  // Redraw whenever waveform data changes
  useEffect(() => {
    waveformDataRef.current = waveformData;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isRecordingRef.current) {
      const currentRms = waveformData?.[waveformData.length - 1] ?? 0;
      drawSplash(canvas, currentRms);
    } else {
      drawWaveform(canvas, waveformData);
    }
  }, [waveformData, drawSplash, drawWaveform]);

  // Redraw on resize so bars never overflow into the controls area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      if (isRecordingRef.current) {
        const data = waveformDataRef.current;
        const currentRms = data?.[data.length - 1] ?? 0;
        drawSplash(canvas, currentRms);
      } else {
        drawWaveform(canvas, waveformDataRef.current);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawSplash, drawWaveform]);

  const controls = (
    <div className="flex flex-shrink-0 items-center justify-end gap-1">
      {isRecording ? (
        <DialGhostIconButton
          icon={
            <IconPlaystationSquare
              size={DIAL_ICON_SIZE.LG}
              className={styles.micRecordingIcon}
              aria-hidden
            />
          }
          aria-label={stopLabel}
          className="size-10 flex-shrink-0"
          onClick={onStop}
        />
      ) : (
        <>
          <DialGhostIconButton
            icon={<IconX size={DIAL_ICON_SIZE.LG} aria-hidden />}
            aria-label={discardLabel}
            className="size-10 flex-shrink-0"
            onClick={onDiscard}
          />
          {isUploading ? (
            <DialSpinner
              fullWidth={false}
              size={DIAL_ICON_SIZE.LG}
              ariaLabel={uploadingLabel}
              className="flex size-10 flex-shrink-0 items-center justify-center"
            />
          ) : (
            <DialGhostIconButton
              icon={
                <div className="flex size-8 items-center justify-center rounded-full bg-controls-accent-primary">
                  <IconCheck
                    size={24}
                    aria-hidden
                    className="text-control-permanent rounded-full bg-controls-accent-primary"
                  />
                </div>
              }
              aria-label={confirmLabel}
              className="size-10 flex-shrink-0"
              onClick={onConfirm}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={className}>
      <div
        style={style}
        className={mergeClasses(
          styles.container,
          'flex min-h-[56px] w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border px-3 desktop:flex-row desktop:items-center desktop:gap-2 desktop:py-2',
          isError && styles.containerError,
        )}
      >
        {/* Row 1 on mobile / inline on desktop: recording dot + canvas */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isRecording && (
            <span
              className={mergeClasses(
                styles.recordingDot,
                'size-2 flex-shrink-0 rounded-full',
              )}
              aria-hidden
            />
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
