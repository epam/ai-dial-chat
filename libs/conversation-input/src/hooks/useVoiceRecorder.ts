import { useCallback, useEffect, useRef, useState } from 'react';

/** Possible states of the voice recorder lifecycle. */
export type VoiceRecorderState =
  | 'idle'
  | 'recording'
  | 'stopped'
  | 'uploading'
  | 'error';

/** Options accepted by `useVoiceRecorder`. */
export interface UseVoiceRecorderOptions {
  /** Called when the user confirms the recording. Resolves with the DIAL storage URL. */
  onUploadAudio?: (file: File, contentType: string) => Promise<string>;
  /** Called after successful upload. Resolves with the transcript text. */
  onTranscribeAudio?: (audioUrl: string) => Promise<string>;
  /** Called when transcription completes successfully. */
  onTranscript?: (transcript: string) => void;
}

/** Return value of `useVoiceRecorder`. */
export interface UseVoiceRecorderResult {
  /** Current recorder state. */
  state: VoiceRecorderState;
  /** Accumulated RMS amplitude history (one value per ~30 fps frame). `null` when idle. Frozen on stop. */
  waveformData: Float32Array | null;
  /** Human-readable error message in `error` state, otherwise `null`. */
  errorMessage: string | null;
  /** Requests microphone access and starts recording. No-op unless `state === 'idle'`. */
  startRecording: () => void;
  /** Stops the active recording. No-op unless `state === 'recording'`. */
  stopRecording: () => void;
  /** Uploads and transcribes the recorded audio. No-op unless `state === 'stopped' | 'error'`. */
  confirmRecording: () => void;
  /** Discards the current recording and resets to `idle`. Works from any non-idle state. */
  discardRecording: () => void;
}

/** Preferred MIME type detection order for MediaRecorder. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
] as const;

const detectMimeType = (): string =>
  MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

/**
 * Manages the five-state voice recording lifecycle:
 * `idle` → `recording` → `stopped` → `uploading` → `idle` (success) | `error` (failure)
 *
 * Waveform data is sampled via `AnalyserNode` at ~30 fps during recording and
 * frozen on stop. Media resources are released on discard and on unmount.
 */
export const useVoiceRecorder = ({
  onUploadAudio,
  onTranscribeAudio,
  onTranscript,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult => {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);
  const recordedFileRef = useRef<File | null>(null);
  const waveformHistoryRef = useRef<number[]>([]);
  /** Set to `true` when a confirm/discard races with an in-flight upload/transcribe. */
  const cancelledRef = useRef<boolean>(false);

  const stopWaveformSampling = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    stopWaveformSampling();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopWaveformSampling]);

  const startRecording = useCallback(() => {
    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        audioContext.createMediaStreamSource(stream).connect(analyser);

        const mimeType = detectMimeType();
        mimeTypeRef.current = mimeType;
        chunksRef.current = [];
        waveformHistoryRef.current = [];

        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start();
        setState('recording');

        // Start waveform sampling loop
        const sample = () => {
          const node = analyserRef.current;
          if (!node) return;
          const buf = new Uint8Array(node.frequencyBinCount);
          node.getByteTimeDomainData(buf);
          // Compute RMS amplitude (0–1)
          let sum = 0;
          for (let j = 0; j < buf.length; j++) {
            const s = (buf[j] - 128) / 128;
            sum += s * s;
          }
          waveformHistoryRef.current.push(Math.sqrt(sum / buf.length));
          setWaveformData(new Float32Array(waveformHistoryRef.current));
          rafIdRef.current = requestAnimationFrame(sample);
        };
        rafIdRef.current = requestAnimationFrame(sample);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Microphone access denied';
        setErrorMessage(msg);
        setState('error');
      }
    };
    void run();
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    stopWaveformSampling();
    // The last frame captured by the RAF loop remains in waveformData — keep it as the frozen histogram.

    // Build the file only after all chunks are flushed (onstop fires after stop())
    recorder.onstop = () => {
      const effectiveMime = mimeTypeRef.current || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: effectiveMime });
      const ext = effectiveMime.split(';')[0].split('/')[1] ?? 'webm';
      recordedFileRef.current = new File([blob], `recording.${ext}`, {
        type: effectiveMime,
      });
      setState('stopped');
    };

    recorder.stop();
  }, [stopWaveformSampling]);

  const confirmRecording = useCallback(() => {
    const file = recordedFileRef.current;
    if (!file || !onUploadAudio || !onTranscribeAudio) return;

    cancelledRef.current = false;
    setState('uploading');

    const run = async () => {
      try {
        const contentType = mimeTypeRef.current || 'audio/webm';
        const url = await onUploadAudio(file, contentType);
        if (cancelledRef.current) return;

        const transcript = await onTranscribeAudio(url);
        if (cancelledRef.current) return;

        cleanupMedia();
        recordedFileRef.current = null;
        setWaveformData(null);
        setErrorMessage(null);
        setState('idle');
        onTranscript?.(transcript);
      } catch (err) {
        if (cancelledRef.current) return;
        const msg = err instanceof Error ? err.message : 'Transcription failed';
        setErrorMessage(msg);
        setState('error');
      }
    };
    void run();
  }, [onUploadAudio, onTranscribeAudio, onTranscript, cleanupMedia]);

  const discardRecording = useCallback(() => {
    cancelledRef.current = true;
    cleanupMedia();
    recordedFileRef.current = null;
    setWaveformData(null);
    setErrorMessage(null);
    setState('idle');
  }, [cleanupMedia]);

  // Release media resources if the component unmounts mid-recording or mid-upload
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    state,
    waveformData,
    errorMessage,
    startRecording,
    stopRecording,
    confirmRecording,
    discardRecording,
  };
};
