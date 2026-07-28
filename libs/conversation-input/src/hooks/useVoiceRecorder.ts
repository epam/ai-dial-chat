import { useCallback, useEffect, useRef, useState } from 'react';

/** Possible states of the voice recorder lifecycle. */
export enum VoiceRecorderState {
  /** Microphone is not active; no recording in progress. */
  Idle = 'idle',
  /** Microphone is open and audio is being captured. */
  Recording = 'recording',
  /** An error occurred during microphone access (e.g. permission denied). */
  Error = 'error',
}

/** Options accepted by `useVoiceRecorder`. */
export interface UseVoiceRecorderOptions {
  /** Called when the user stops recording. Receives a ready-to-attach `File` with a timestamped name. */
  onAttachAudio: (file: File) => void;
}

/** Return value of `useVoiceRecorder`. */
export interface UseVoiceRecorderResult {
  /** Current recorder state. */
  state: VoiceRecorderState;
  /**
   * Stable ref to the live `AnalyserNode` during recording; `.current` is `null` when idle.
   * Passed to `VoiceBar` for waveform rendering.
   */
  analyserNodeRef: React.RefObject<AnalyserNode | null>;
  /** Elapsed recording time in whole seconds. Resets to `0` when transitioning to `idle`. */
  elapsedSeconds: number;
  /** Human-readable error message in `error` state, otherwise `null`. */
  errorMessage: string | null;
  /** Requests microphone access and starts recording. No-op unless `state === 'idle'`. */
  startRecording: () => void;
  /**
   * Stops the active recording, calls `onAttachAudio` with the blob, and resets to `idle`.
   * No-op unless `state === 'recording'`.
   */
  stopRecording: () => void;
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

/** Manages voice recording state and media resources. */
export const useVoiceRecorder = ({
  onAttachAudio,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult => {
  const [state, setState] = useState<VoiceRecorderState>(
    VoiceRecorderState.Idle,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* Stable ref so the onstop closure always calls the latest callback. */
  const onAttachAudioRef = useRef(onAttachAudio);
  onAttachAudioRef.current = onAttachAudio;

  const stopTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    stopTimer();
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
  }, [stopTimer]);

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

        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start();
        setState(VoiceRecorderState.Recording);

        intervalRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Microphone access denied';
        setErrorMessage(msg);
        setState(VoiceRecorderState.Error);
      }
    };
    void run();
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    stopTimer();

    recorder.onstop = () => {
      const effectiveMime = mimeTypeRef.current || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: effectiveMime });
      const baseMime = effectiveMime.split(';')[0];
      const ext = baseMime.split('/')[1] ?? 'webm';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
      const file = new File([blob], `voice-${ts}.${ext}`, { type: baseMime });
      onAttachAudioRef.current(file);
      cleanupMedia();
      setElapsedSeconds(0);
      setErrorMessage(null);
      setState(VoiceRecorderState.Idle);
    };

    recorder.stop();
  }, [stopTimer, cleanupMedia]);

  const discardRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    cleanupMedia();
    setElapsedSeconds(0);
    setErrorMessage(null);
    setState(VoiceRecorderState.Idle);
  }, [cleanupMedia]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    state,
    analyserNodeRef: analyserRef,
    elapsedSeconds,
    errorMessage,
    startRecording,
    stopRecording,
    discardRecording,
  };
};
