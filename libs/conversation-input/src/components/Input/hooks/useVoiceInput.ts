import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { useAttachments } from '../../../hooks/useAttachments';
import type { useInputHistoryNavigation } from '../../../hooks/useInputHistoryNavigation';
import type { useMessageState } from '../../../hooks/useMessageState';
import {
  useVoiceRecorder,
  VoiceRecorderState,
} from '../../../hooks/useVoiceRecorder';
import type { TranscribeAudio } from '../../../models/Voice';

type Attachments = ReturnType<typeof useAttachments>;

interface UseVoiceInputParams {
  addAttachments: Attachments['addAttachments'];
  buildAttachments: Attachments['buildAttachments'];
  /* The latest draft text, owned by `Input` and shared with pasted-text expansion. */
  draftRef: MutableRefObject<string>;
  setMessage: ReturnType<typeof useMessageState>['setMessage'];
  historyNav: ReturnType<typeof useInputHistoryNavigation>;
  onChange: ((message: string) => void) | undefined;
  onTranscribeAudio: TranscribeAudio | undefined;
  voiceErrorLabel: string | undefined;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /* Owned by the command-menu wiring; set here so the focus restored after recording skips one menu evaluation. */
  skipFocusMenuEvaluationRef: MutableRefObject<boolean>;
}

/**
 * Voice recording for `Input`: attaches recorded audio or merges a transcript
 * into the draft, and puts focus and the caret back at the end of the
 * textarea once recording ends. Private to `Input`.
 */
export const useVoiceInput = ({
  addAttachments,
  buildAttachments,
  draftRef,
  setMessage,
  historyNav,
  onChange,
  onTranscribeAudio,
  voiceErrorLabel,
  textareaRef,
  skipFocusMenuEvaluationRef,
}: UseVoiceInputParams) => {
  const handleAttachAudio = useCallback(
    (file: File) => {
      addAttachments(buildAttachments([file]));
    },
    [addAttachments, buildAttachments],
  );

  const focusAfterTranscriptRef = useRef(false);
  const [latestTranscript, setLatestTranscript] = useState({
    text: '',
    revision: 0,
  });
  const handleTranscript = useCallback(
    (text: string) => {
      const transcript = text.trim();
      if (transcript) {
        const draft = draftRef.current;
        const nextMessage = `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}${transcript}`;
        draftRef.current = nextMessage;
        setMessage(nextMessage);
        setLatestTranscript((previous) => ({
          text: transcript,
          revision: previous.revision + 1,
        }));
        historyNav.notifyChange();
        onChange?.(nextMessage);
      }
      focusAfterTranscriptRef.current = true;
    },
    [draftRef, setMessage, historyNav, onChange],
  );

  const {
    state: voiceState,
    analyserNodeRef,
    errorMessage: voiceError,
    startRecording,
    stopRecording,
    discardRecording,
  } = useVoiceRecorder({
    onAttachAudio: handleAttachAudio,
    onTranscribeAudio,
    onTranscript: handleTranscript,
    errorLabel: voiceErrorLabel,
  });
  const isVoiceActive =
    voiceState === VoiceRecorderState.Recording ||
    voiceState === VoiceRecorderState.Processing;

  useEffect(() => {
    if (
      voiceState === VoiceRecorderState.Error ||
      (voiceState === VoiceRecorderState.Idle &&
        focusAfterTranscriptRef.current)
    ) {
      focusAfterTranscriptRef.current = false;
      const textarea = textareaRef.current;
      if (textarea != null) {
        /*
         * The textarea is unmounted while recording, so it comes back as a
         * fresh element whose caret sits at the start; a plain `focus()`
         * would leave it there and the focus handler would re-open the
         * command menu over a leading `/skill`. Put the caret at the end
         * and skip that one focus-time menu evaluation.
         */
        skipFocusMenuEvaluationRef.current =
          document.activeElement !== textarea;
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }
    }
  }, [voiceState, textareaRef, skipFocusMenuEvaluationRef]);

  return {
    voiceState,
    analyserNodeRef,
    voiceError,
    startRecording,
    stopRecording,
    discardRecording,
    isVoiceActive,
    latestTranscript,
  };
};
