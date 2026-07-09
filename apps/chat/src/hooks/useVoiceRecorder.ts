import { useCallback, useEffect, useRef, useState } from 'react';
import { isSafari } from 'react-device-detect';

import { AudioMimeCandidate, NegotiatedFormat } from '@/src/types/audio';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { AudioMimeType } from '@/src/constants/audio';

const MIME_CANDIDATES = [
  {
    mimeType: 'audio/ogg;codecs=opus',
    baseMime: AudioMimeType.OGG,
    ext: '.ogg',
  },
  { mimeType: AudioMimeType.OGG, baseMime: AudioMimeType.OGG, ext: '.ogg' },
  {
    mimeType: 'audio/webm;codecs=opus',
    baseMime: AudioMimeType.WEBM,
    ext: '.weba',
  },
  { mimeType: AudioMimeType.WEBM, baseMime: AudioMimeType.WEBM, ext: '.weba' },
  { mimeType: AudioMimeType.MP4, baseMime: AudioMimeType.MP4, ext: '.m4a' },
];

const getSafariOrderedCandidates = (mimeCandidates: AudioMimeCandidate[]) => {
  const mp4 = mimeCandidates.filter((c) => c.baseMime === AudioMimeType.MP4);
  const rest = mimeCandidates.filter((c) => c.baseMime !== AudioMimeType.MP4);
  return [...mp4, ...rest];
};

const getOrderedCandidates = (audioTypesDefaultOrder: string[]) => {
  if (audioTypesDefaultOrder.length > 0) {
    const defaultOrder = audioTypesDefaultOrder
      .map((mimeType) => MIME_CANDIDATES.find((c) => c.mimeType === mimeType))
      .filter(Boolean) as AudioMimeCandidate[];

    if (defaultOrder.length !== MIME_CANDIDATES.length) {
      const rest = MIME_CANDIDATES.filter((c) => !defaultOrder.includes(c));
      const orderedRest = isSafari ? getSafariOrderedCandidates(rest) : rest;
      return [...defaultOrder, ...orderedRest];
    }
    return defaultOrder;
  }
  return isSafari
    ? getSafariOrderedCandidates(MIME_CANDIDATES)
    : MIME_CANDIDATES;
};

const negotiateFormat = (
  modelAudioTypes: string[],
  audioTypesDefaultOrder: string[],
): NegotiatedFormat | null => {
  const hasWildcard =
    modelAudioTypes.includes('*/*') || modelAudioTypes.includes('audio/*');

  const candidates = getOrderedCandidates(audioTypesDefaultOrder);
  for (const candidate of candidates) {
    if (!MediaRecorder.isTypeSupported(candidate.mimeType)) {
      continue;
    }
    if (
      hasWildcard ||
      modelAudioTypes.some(
        (t) =>
          t.toLowerCase() === candidate.baseMime ||
          t.toLowerCase() === candidate.mimeType,
      )
    ) {
      return { mimeType: candidate.mimeType, ext: candidate.ext };
    }
  }

  return null;
};

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  audioBlob: Blob | null;
  analyserNode: AnalyserNode | null;
  error: string | null;
  elapsedTime: number;
  resolvedMimeType: string | null;
  fileExtension: string;
  clearAudioBlob: () => void;
}

export const useVoiceRecorder = (
  modelAudioTypes: string[],
): UseVoiceRecorderResult => {
  const audioTypesDefaultOrder = useAppSelector(
    SettingsSelectors.selectAudioTypesDefaultOrder,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formatRef = useRef<NegotiatedFormat | null>(null);
  // Guards against race condition: stop() can be called while async getUserMedia is still pending.
  // stopRequestedRef — signals that stop was requested before the stream was acquired.
  // isStoppingRef — true between MediaRecorder.stop() and its async onstop callback.
  const stopRequestedRef = useRef(false);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    formatRef.current = negotiateFormat(
      modelAudioTypes,
      audioTypesDefaultOrder,
    );
  }, [modelAudioTypes, audioTypesDefaultOrder]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    mediaRecorderRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setAnalyserNode(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    // Wait for any in-progress stop to finish (onstop callback is async).
    // Uses requestAnimationFrame polling because there is no event to await.
    if (isStoppingRef.current) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!isStoppingRef.current) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    }

    cleanup();

    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    setElapsedTime(0);
    stopRequestedRef.current = false;

    const format = formatRef.current;
    if (!format) {
      setError('AudioFormatNotSupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop was requested while getUserMedia was pending — discard the stream
      if (stopRequestedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const recorder = new MediaRecorder(stream, {
        mimeType: format.mimeType,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: format.mimeType });
        setAudioBlob(blob);
        chunksRef.current = [];
        isStoppingRef.current = false;
      };

      recorder.start(100);
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch {
      setError('MicrophonePermissionDenied');
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    stopRequestedRef.current = true;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      isStoppingRef.current = true;
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAnalyserNode(null);
    setIsRecording(false);
  }, []);

  const clearAudioBlob = useCallback(() => {
    setAudioBlob(null);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    analyserNode,
    error,
    elapsedTime,
    resolvedMimeType: formatRef.current?.mimeType ?? null,
    fileExtension: formatRef.current?.ext ?? '.ogg',
    clearAudioBlob,
  };
};
