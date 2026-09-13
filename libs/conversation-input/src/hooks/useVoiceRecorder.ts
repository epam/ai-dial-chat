import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscribeAudio } from '../models/Voice';

/** Possible states of the voice recorder lifecycle. */
export enum VoiceRecorderState {
  /** No capture or recognition in progress. */
  Idle = 'idle',
  /** Microphone is actively capturing audio. */
  Recording = 'recording',
  /** Capture has stopped and the recording is being recognized or delivered. */
  Processing = 'processing',
  /** Capture or recognition failed; `errorMessage` holds the reason. */
  Error = 'error',
}

/** Selects how the completed recording is delivered. */
export enum VoiceRecordingMode {
  Dictation = 'dictation',
  Attachment = 'attachment',
}

/** Options accepted by useVoiceRecorder. */
export interface UseVoiceRecorderOptions {
  /** Receives one complete recording when recognition is not supplied. */
  onAttachAudio: (file: File) => void;
  /** Recognizes the complete recording after capture stops. */
  onTranscribeAudio?: TranscribeAudio;
  /**
   * Receives the recognized text once unless the session is cancelled. Also
   * fires with an empty string when a dictation capture is discarded as
   * silent or too short, so hosts can still react to the session ending.
   */
  onTranscript?: (text: string) => void;
  /** Fallback message for recording or processing failures. */
  errorLabel?: string;
}

/** Recorder controls and state shared with the voice bar. */
export interface UseVoiceRecorderResult {
  /** Current lifecycle state of the recorder. */
  state: VoiceRecorderState;
  /** Analyser node for the active session's audio stream, or `null` when idle. */
  analyserNodeRef: React.RefObject<AnalyserNode | null>;
  /** Message for the most recent capture or recognition failure, or `null`. */
  errorMessage: string | null;
  /** Starts a new capture session in the given mode; a no-op while one is already active. */
  startRecording: (mode?: VoiceRecordingMode) => void;
  /** Ends capture and recognizes the complete recording. */
  stopRecording: () => void;
  /** Cancels capture or pending recognition. */
  discardRecording: () => void;
}

interface RecordingSession {
  controller: AbortController;
  stop?: () => void;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
] as const;
const SAMPLE_INTERVAL_MS = 100;
const MIN_AUDIO_MS = 100;
const SPEECH_THRESHOLD = 0.01;

/** Captures one complete audio file and processes it after Stop. */
export const useVoiceRecorder = ({
  onAttachAudio,
  onTranscribeAudio,
  onTranscript,
  errorLabel = 'Voice input failed',
}: UseVoiceRecorderOptions): UseVoiceRecorderResult => {
  const [state, setState] = useState(VoiceRecorderState.Idle);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const callbacksRef = useRef({
    onAttachAudio,
    onTranscribeAudio,
    onTranscript,
    errorLabel,
  });
  callbacksRef.current = {
    onAttachAudio,
    onTranscribeAudio,
    onTranscript,
    errorLabel,
  };

  const startRecording = useCallback((mode = VoiceRecordingMode.Dictation) => {
    if (sessionRef.current) return;
    const session: RecordingSession = { controller: new AbortController() };
    sessionRef.current = session;
    setState(VoiceRecorderState.Recording);
    const { signal } = session.controller;
    /* Freeze the provider for the session; transcript delivery uses the latest
     * callback so external draft updates are respected while recognition runs. */
    const transcribe =
      mode === VoiceRecordingMode.Dictation
        ? callbacksRef.current.onTranscribeAudio
        : undefined;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let recorder: MediaRecorder | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let captureEnded = false;
    let processed = false;
    const chunks: Blob[] = [];

    const clearTimer = () => {
      clearInterval(timer);
      timer = undefined;
    };

    const releaseMedia = () => {
      clearTimer();
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') recorder.stop();
        recorder = undefined;
      }
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      if (audioContext) {
        void audioContext.close();
        audioContext = undefined;
      }
      if (sessionRef.current === session) analyserRef.current = null;
    };

    signal.addEventListener(
      'abort',
      () => {
        chunks.length = 0;
        releaseMedia();
      },
      { once: true },
    );

    const finish = () => {
      if (signal.aborted) return;
      releaseMedia();
      sessionRef.current = null;
      setErrorMessage(null);
      setState(VoiceRecorderState.Idle);
    };

    const fail = (error: unknown) => {
      if (signal.aborted) return;
      session.controller.abort();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : callbacksRef.current.errorLabel,
      );
      setState(VoiceRecorderState.Error);
    };

    const startCapture = () => {
      if (!stream || signal.aborted) return;
      const mime = MIME_CANDIDATES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const currentRecorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder = currentRecorder;
      const startedAt = Date.now();
      let sampled = false;
      let hasSpeech = false;
      const samples = new Uint8Array(analyserRef.current?.fftSize ?? 256);

      const processRecording = async () => {
        if (processed || signal.aborted) return;
        processed = true;
        captureEnded = true;
        try {
          /* Include every blob, including the final event and container header.
           * Individual dataavailable events are never sent to recognition. */
          const mimeType = currentRecorder.mimeType || mime || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          chunks.length = 0;
          releaseMedia();
          const hasAudio = Date.now() - startedAt >= MIN_AUDIO_MS;
          if (
            blob.size &&
            (!transcribe || (hasAudio && (!sampled || hasSpeech)))
          ) {
            const extension = mimeType.split(';')[0].split('/')[1] ?? 'webm';
            const file = new File(
              [blob],
              'voice-' + crypto.randomUUID() + '.' + extension,
              { type: mimeType },
            );
            if (transcribe) {
              setState(VoiceRecorderState.Processing);
              const text = await transcribe(file, signal);
              if (signal.aborted) return;
              callbacksRef.current.onTranscript?.(text);
            } else {
              callbacksRef.current.onAttachAudio(file);
            }
          } else if (transcribe) {
            /* Capture ended with no usable speech (too short or silent).
             * Notify with an empty transcript anyway so hosts driving focus
             * off onTranscript (e.g. returning it to the textarea) still see
             * the session end. */
            callbacksRef.current.onTranscript?.('');
          }
          finish();
        } catch (error) {
          fail(error);
        }
      };

      currentRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      currentRecorder.onerror = () =>
        fail(new Error(callbacksRef.current.errorLabel));
      currentRecorder.onstop = () => {
        void processRecording();
      };
      currentRecorder.start();
      if (transcribe) {
        /* Sampling only skips entirely silent recordings; pauses never split
         * or stop capture. The same recorder stays active until Stop. */
        timer = setInterval(() => {
          const analyser = analyserRef.current;
          if (!analyser) return;
          analyser.getByteTimeDomainData(samples);
          sampled = true;
          let sum = 0;
          for (const value of samples) sum += ((value - 128) / 128) ** 2;
          if (Math.sqrt(sum / samples.length) >= SPEECH_THRESHOLD) {
            hasSpeech = true;
            clearTimer();
          }
        }, SAMPLE_INTERVAL_MS);
      }
    };

    session.stop = () => {
      if (captureEnded || signal.aborted) return;
      captureEnded = true;
      clearTimer();
      setState(VoiceRecorderState.Processing);
      /* The final recorder events own the complete file. Permission may still
       * be pending, in which case run releases the acquired stream below. */
      if (recorder?.state === 'recording') recorder.stop();
    };

    const run = async () => {
      try {
        const acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (signal.aborted || captureEnded) {
          acquiredStream.getTracks().forEach((track) => track.stop());
          finish();
          return;
        }
        stream = acquiredStream;
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        startCapture();
        setState(VoiceRecorderState.Recording);
      } catch (error) {
        fail(error);
      }
    };
    void run();
  }, []);

  const stopRecording = useCallback(() => sessionRef.current?.stop?.(), []);
  const discardRecording = useCallback(() => {
    sessionRef.current?.controller.abort();
    sessionRef.current = null;
    setErrorMessage(null);
    setState(VoiceRecorderState.Idle);
  }, []);

  useEffect(
    () => () => {
      sessionRef.current?.controller.abort();
      sessionRef.current = null;
    },
    [],
  );

  return {
    state,
    analyserNodeRef: analyserRef,
    errorMessage,
    startRecording,
    stopRecording,
    discardRecording,
  };
};
