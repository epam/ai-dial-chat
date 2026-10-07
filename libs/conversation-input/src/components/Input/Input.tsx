import {
  AttachmentTray,
  useClipboardPaste,
} from '@epam/ai-dial-attachment-input';
import {
  buildCssVars,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  ErrorText,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconFile, IconMicrophone } from '@tabler/icons-react';
import {
  ChangeEvent,
  ClipboardEvent,
  forwardRef,
  KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import { useAttachments } from '../../hooks/useAttachments';
import {
  CommandMenuOptionStep,
  useCommandMenu,
} from '../../hooks/useCommandMenu/useCommandMenu';
import { useInputHistoryNavigation } from '../../hooks/useInputHistoryNavigation';
import { useMentionSelectionMirror } from '../../hooks/useMentionSelectionMirror';
import { useMessageState } from '../../hooks/useMessageState';
import {
  applyValueThroughReact,
  useTextInsertion,
} from '../../hooks/useTextInsertion';
import {
  useVoiceRecorder,
  VoiceRecorderState,
  VoiceRecordingMode,
} from '../../hooks/useVoiceRecorder';
import { ActionRowLayout, SendOnEnter } from '../../models/Input';
import type { InputHandle, InputProps } from '../../models/Input';
import {
  renderHighlightedText,
  type MirrorInsertion,
} from '../../utils/highlight-mirror';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton';
import { ToolsChips } from '../ToolsChips/ToolsChips';
import { VoiceBar } from '../VoiceBar/VoiceBar';
import { SendButton } from './Buttons/SendButton';
import { StopButton } from './Buttons/StopButton';
import styles from './Input.module.scss';
import { ModelSelectorControl } from './ModelSelectorControl';

/** Full conversation input field: textarea, send/stop, model selector, attachment menu, voice recording, and chat-settings controls. */
export const Input = forwardRef<InputHandle, InputProps>(
  (
    {
      message: messageProp = '',
      messageRevision,
      focusRequestId,
      textInsertion,
      onSend,
      onUploadAttachment,
      onStop,
      isStreaming = false,
      onChange,
      onAttachmentsChange,
      placeholder = 'Type a message...',
      ariaLabel,
      attachLabel = 'Attach file',
      fileAccept,
      addMenuTitle = 'Add',
      menuTitle = 'Menu',
      menuCloseLabel = 'Close',
      removeLabel,
      retryLabel,
      uploadingLabel,
      expandLabel,
      clickLabel,
      sendLabel,
      sendTooltip,
      emptyMessageTooltip,
      stopLabel,
      micLabel = 'Dictate',
      recordVoiceLabel = 'Record voice',
      stopRecordingLabel,
      discardRecordingLabel,
      colors,
      typography,
      attachmentTray,
      modelMenu,
      className,
      pendingDropFiles = [],
      onDropFilesConsumed,
      pendingAttachments = [],
      onPendingAttachmentsConsumed,
      pasteTextThreshold = 4000,
      maxMessageLength = 50000,
      deployments,
      selectedDeploymentId,
      onDeploymentChange,
      modelSelectorLabels,
      initialAttachments = [],
      hideAddButton = false,
      hideAttachFile = false,
      hideActionBar = false,
      actionRowLayout = ActionRowLayout.Stacked,
      isInlineActionRowAllowedBelowDesktop = false,
      renderFooterActions,
      isInputDisabled = false,
      isModelSelectorDisabled = false,
      isSendDisabled = false,
      isAudioMessageSupported = false,
      isVoiceRecordingSupported = isAudioMessageSupported,
      onTranscribeAudio,
      transcribingLabel,
      voiceErrorLabel,
      sendOnEnter = SendOnEnter.Enter,
      prefixAttachments = [],
      onRemovePrefixAttachment,
      chatSettings,
      toolsMenuItems,
      onToolToggle,
      canRemoveTools = true,
      toolsMenuTitle,
      toolsBackLabel,
      toolsChipLabels,
      menuOverlays,
      activeMentions,
      onBackspaceAtCaret,
      caretPositionOverride,
      commandMenu,
      autoFocus = false,
      messageHistory,
      onDialFileSystemClick,
      dialFileSystemLabel,
      validateAttachment,
      onAttachmentClick,
      modelPickerOverlay,
      maximumAttachmentsAmount,
      onAttachmentsLimitExceeded,
      isAttachmentsEnabled = true,
      isTextAttachmentsAllowed = true,
      usageLimitsSlot,
      onMessageTooLong,
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const historyNav = useInputHistoryNavigation(messageHistory);
    const mentionRanges = activeMentions ?? [];
    const hasActiveMentions = mentionRanges.length > 0;

    const cssVars = useMemo(
      () =>
        buildCssVars({
          '--ci-bg': colors?.background,
          '--ci-text': colors?.text,
          '--ci-border': colors?.border,
          '--ci-border-focus': colors?.borderFocus,
          '--ci-placeholder': colors?.placeholder,
          '--ci-text-disabled': colors?.textDisabled,
          '--ci-model-selector-caret-color': colors?.modelSelectorCaret,
          '--ci-model-selector-hover-bg': colors?.modelSelectorHoverBg,
          '--ci-model-selector-disabled-color': colors?.modelSelectorDisabled,
          '--ci-model-selector-name-color': colors?.modelSelectorName,
          '--ci-model-selector-version-color': colors?.modelSelectorVersion,
          '--ci-voice-waveform': colors?.voiceWaveform,
          '--ci-voice-accent': colors?.voiceAccent,
          '--ci-mention-highlight-bg': colors?.mentionHighlightBg,
          '--ci-mention-highlight-text': colors?.mentionHighlightText,
          '--ci-mention-highlight-unsupported-bg':
            colors?.mentionHighlightUnsupportedBg,
          '--ci-mention-highlight-unsupported-text':
            colors?.mentionHighlightUnsupportedText,
        }),
      [colors],
    );

    const dialFileSystemMenuItem = useMemo(
      () =>
        onDialFileSystemClick
          ? [
              {
                key: 'dial-fs',
                label: dialFileSystemLabel ?? 'DIAL file system',
                icon: (
                  <IconFile
                    size={BASE_ICON_SIZE}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: onDialFileSystemClick,
              },
            ]
          : [],
      [onDialFileSystemClick, dialFileSystemLabel],
    );

    const { message, setMessage, textareaRef } = useMessageState({
      messageProp,
      messageRevision,
    });

    useEffect(() => {
      if (focusRequestId !== undefined) textareaRef.current?.focus();
    }, [focusRequestId, textareaRef]);

    useImperativeHandle(
      ref,
      () => ({
        getCaretPosition: () =>
          textareaRef.current?.selectionStart ?? message.length,
      }),
      [message, textareaRef],
    );

    const { handleUndoKeyDown } = useTextInsertion({
      insertion: textInsertion,
      textareaRef,
    });

    const {
      isMenuOpen,
      query,
      activeWordStart,
      dismiss,
      closeOnOutsidePress,
      handleCaretMove: handleCommandMenuCaretMove,
      handleValueChange,
      listboxId: commandMenuListboxId,
      overlayRef: commandMenuOverlayRef,
      activeOptionId: activeCommandOptionId,
      moveActiveOption: moveActiveCommandOption,
      getActiveOption: getActiveCommandOption,
    } = useCommandMenu({
      config: commandMenu,
      message,
    });

    /*
     * `handleCommandMenuCaretMove` evaluates the word at a given caret
     * position, so it needs that position resolved. A mouse click's own
     * caret is already resolved by the time React's `onClick` fires, but the
     * `focus` event that precedes it can fire before the browser has placed
     * the caret — reading `selectionStart` there is unreliable across
     * browsers — so `onFocus` defers one frame, by when it always has.
     */
    const handleTextareaClick = () => {
      handleCommandMenuCaretMove(
        textareaRef.current?.selectionStart ?? message.length,
      );
    };
    const handleTextareaFocus = () => {
      requestAnimationFrame(() => {
        handleCommandMenuCaretMove(
          textareaRef.current?.selectionStart ?? message.length,
        );
      });
    };

    /*
     * Keyboard caret movement (Left/Right/Home/End/PageUp/PageDown) needs the
     * same re-evaluation as a click, since it can carry the caret into or out
     * of a command-shaped word with no `onChange` — the keys the command menu
     * itself consumes for navigation (ArrowUp/ArrowDown/Enter, only while it's
     * already open, see `handleCommandMenuKeyDown`) are excluded so this never
     * double-processes those. `keyup`, not `keydown`, because the browser has
     * already moved the caret to its new position by then.
     */
    const handleTextareaKeyUp = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'Home' &&
        e.key !== 'End' &&
        e.key !== 'PageUp' &&
        e.key !== 'PageDown'
      ) {
        return;
      }
      handleCommandMenuCaretMove(
        e.currentTarget.selectionStart ?? message.length,
      );
    };

    /*
     * The command menu's empty-query hint: while the menu is open the value is
     * the trigger prefix plus the query, so an empty query means the textarea
     * holds exactly the prefix — the hint renders right after it and disappears
     * with the first query keystroke. This gates only the hint content itself:
     * the textarea's wrapper below is driven by the hint's *configuration*, not
     * the live menu state, so the hint appearing and disappearing never
     * remounts the textarea mid-typing.
     *
     * The hint is spliced in as real inline content of the highlight mirror
     * (see `insertions` below), not a separately-positioned overlay, so it
     * never pushes real text out of the way — anything after the trigger on
     * the *same line* would sit right after the hint and read as one run, so
     * the hint is suppressed whenever the line the trigger is on has more
     * text after it — content on a later line is unaffected, since the hint
     * never extends past its own line.
     */
    const hasCommandHintConfigured = commandMenu?.emptyQueryHint != null;
    const triggerEnd =
      commandMenu != null && activeWordStart != null
        ? activeWordStart + commandMenu.triggerPrefix.length
        : null;
    const hasContentAfterTriggerOnLine =
      triggerEnd != null && message.slice(triggerEnd).split('\n', 1)[0] !== '';
    const hasCommandEmptyQueryHint =
      hasCommandHintConfigured &&
      isMenuOpen &&
      query === '' &&
      triggerEnd != null &&
      !hasContentAfterTriggerOnLine;

    /*
     * The command menu's trigger word can sit anywhere in the message, not
     * only at its very start, so the popup must be positioned at that word's
     * actual on-screen location rather than a fixed corner. `markerOffset` is
     * that word's character offset whenever the menu is open; a zero-size
     * marker `<span>` is spliced into the invisible mention-highlight mirror
     * at that offset (`insertions` below), and its measured position becomes
     * the pixel anchor the popup's wrapper div positions itself at. The
     * empty-query hint does not need this: it renders as real inline content
     * of the same mirror, so it inherits the exact line position for free.
     */
    const markerOffset =
      commandMenu != null && isMenuOpen ? (activeWordStart ?? 0) : null;
    /*
     * `left`/`top` (physical, not logical) is intentional here: the value is
     * a real measured pixel position read off the marker's rendered box,
     * which already reflects the browser's own RTL glyph placement — the
     * same measured-value exception `left-1/2 -translate-x-1/2` centering
     * gets in `.claude/rules/rtl.md`, not a static directional utility that
     * would need an `rtl:`/logical counterpart.
     */
    const caretMarkerRef = useRef<HTMLSpanElement | null>(null);
    const textareaAreaRef = useRef<HTMLDivElement | null>(null);
    const [caretAnchor, setCaretAnchor] = useState<{
      left: number;
      top: number;
    } | null>(null);

    /*
     * `getBoundingClientRect()` diff against `textareaAreaRef`, not
     * `offsetLeft`/`offsetTop` — see `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3b
     * (multi-skill-message-mentions).
     */
    const measureCaretAnchor = useCallback(() => {
      const marker = caretMarkerRef.current;
      const container = textareaAreaRef.current;
      if (marker == null || container == null) {
        setCaretAnchor(null);
        return;
      }
      const markerRect = marker.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setCaretAnchor({
        left: markerRect.left - containerRect.left,
        top: markerRect.top - containerRect.top,
      });
    }, []);

    useLayoutEffect(() => {
      measureCaretAnchor();
    }, [measureCaretAnchor, markerOffset, message]);

    /*
     * Auto-resizing the textarea's own width (e.g. a container resize) can
     * reflow where the marker's line wraps without changing `message` or
     * `markerOffset` — re-measure whenever the textarea's box changes while
     * an overlay actually needs the position.
     */
    useEffect(() => {
      if (markerOffset == null) return undefined;
      const textareaEl = textareaRef.current;
      if (textareaEl == null || typeof ResizeObserver === 'undefined') {
        return undefined;
      }
      const observer = new ResizeObserver(measureCaretAnchor);
      observer.observe(textareaEl);
      return () => observer.disconnect();
    }, [markerOffset, textareaRef, measureCaretAnchor]);

    /*
     * Selection path of the command menu: removes the `/query` text from the
     * textarea so it is never sent, resets the draft-history state to match,
     * and notifies the host. The consume lives here because the textarea value
     * is owned by this component — a host-side removal would race the lib.
     */
    const handleCloseCommandMenu = useCallback(
      (options?: { consumeQuery?: boolean; returnFocus?: boolean }) => {
        if (commandMenu == null) return;

        dismiss();
        if (!options?.consumeQuery) return;

        /* Return focus to the textarea (skipped for `returnFocus: false` — see the `commandMenu` doc on `close`). */
        if (options.returnFocus !== false) textareaRef.current?.focus();

        if (activeWordStart == null) return;

        const consumed = `${commandMenu.triggerPrefix}${query}`;
        const consumedEnd = activeWordStart + consumed.length;
        if (message.slice(activeWordStart, consumedEnd) !== consumed) return;

        const nextMessage =
          message.slice(0, activeWordStart) + message.slice(consumedEnd);
        setMessage(nextMessage);
        historyNav.notifyChange();
        onChange?.(nextMessage);
      },
      [
        commandMenu,
        dismiss,
        query,
        message,
        activeWordStart,
        setMessage,
        historyNav,
        onChange,
        textareaRef,
      ],
    );

    /*
     * Places the caret once per host-driven resync (e.g. right after the host
     * pushes a new `message` that spliced in a mention at a known position),
     * so the user can keep typing from exactly where the inserted text ends
     * rather than wherever the browser defaults the caret to after a
     * programmatic value change. Keyed on `message` (the state `useMessageState`
     * actually resyncs, not `messageRevision` itself): a prop change and its
     * resulting `setMessage` call land in two separate commits, and assigning
     * `.value` on that later commit resets the caret — this effect must run
     * after that assignment, not alongside the prop-change commit that
     * precedes it. `revisionRef` applies the override once per bump so it
     * doesn't refire on every ordinary keystroke.
     */
    const appliedCaretRevisionRef = useRef<number | undefined>(undefined);
    useEffect(() => {
      if (
        caretPositionOverride == null ||
        appliedCaretRevisionRef.current === messageRevision
      ) {
        return;
      }
      appliedCaretRevisionRef.current = messageRevision;
      textareaRef.current?.setSelectionRange(
        caretPositionOverride,
        caretPositionOverride,
      );
      /* Re-evaluates the command menu for this new caret position — a programmatic restore can land the caret back in a matching `/word`. */
      handleCommandMenuCaretMove(caretPositionOverride);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message]);

    const handleExpandPastedText = useCallback(
      (text: string) => {
        setMessage((prev) => (prev ? `${prev}\n${text}` : text));
      },
      [setMessage],
    );

    const {
      attachments,
      buildAttachments,
      addAttachments,
      resetAttachments,
      handleRemove,
      handleRetry,
      handleExpand,
      hasBlockedAttachments,
    } = useAttachments({
      initialAttachments,
      onUploadAttachment,
      onAttachmentsChange,
      validateAttachment,
      pendingDropFiles,
      onDropFilesConsumed,
      isDropDisabled: isInputDisabled,
      pendingAttachments,
      onPendingAttachmentsConsumed,
      onExpandPastedText: handleExpandPastedText,
      maximumAttachmentsAmount,
      baseAttachmentsAmount: prefixAttachments.length,
      onAttachmentsLimitExceeded,
    });

    const handleAttachAudio = useCallback(
      (file: File) => {
        addAttachments(buildAttachments([file]));
      },
      [addAttachments, buildAttachments],
    );

    const focusAfterTranscriptRef = useRef(false);
    const draftRef = useRef(message);
    draftRef.current = message;
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
      [setMessage, historyNav, onChange],
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
        textareaRef.current?.focus();
      }
    }, [voiceState, textareaRef]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    /*
     * A long plain-text paste becomes a `text/plain` attachment only when the
     * selected model would accept one: `isAttachmentsEnabled` says attachments
     * are supported at all, `isTextAttachmentsAllowed` says a `text/plain`
     * attachment would pass the host's validation. On a model that accepts
     * only other kinds of attachments (e.g. images only), converting the paste
     * would produce an attachment the model rejects.
     */
    const isPasteAsAttachmentEnabled =
      isAttachmentsEnabled && isTextAttachmentsAllowed;
    const { handlePaste: handleClipboardPaste } = useClipboardPaste(
      addAttachments,
      isPasteAsAttachmentEnabled ? pasteTextThreshold : Infinity,
    );

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLTextAreaElement>) => {
        /*
         * Deliberately narrower than the send gate above. When a paste becomes
         * an attachment it never reaches the textarea, so warning here would be
         * about text the user did not paste inline; an under-threshold paste is
         * at most pasteTextThreshold characters and cannot reach the cap on its
         * own. Existing text plus a small paste crossing the cap is not visible
         * from the pasted string's length at all — the send gate catches that.
         */
        if (!isPasteAsAttachmentEnabled) {
          const text = e.clipboardData.getData('text/plain');
          if (text.length >= maxMessageLength) {
            onMessageTooLong?.(text.length, maxMessageLength);
          }
        }
        handleClipboardPaste(e);
      },
      [
        isPasteAsAttachmentEnabled,
        maxMessageLength,
        onMessageTooLong,
        handleClipboardPaste,
      ],
    );

    /*
     * A tracked mention's `/{name}` text is part of `message` itself, so a
     * message that carries only a mention already has non-whitespace content —
     * no separate "has a mention" branch is needed here.
     */
    const hasSendableContent =
      message.trim().length > 0 || attachments.length > 0;
    const canSend =
      hasSendableContent &&
      !hasBlockedAttachments &&
      !isSendDisabled &&
      !isVoiceActive;
    /*
     * Chips the user dismissed with the chip's ×. Dismissal is view state of this
     * input only: a dismissed tool comes back the moment it is switched on again
     * from the `+` menu, and the whole set is forgotten when the deployment
     * offers a different list of tools.
     */
    const [dismissedToolIds, setDismissedToolIds] = useState<string[]>([]);
    const toolIdsSignature = (toolsMenuItems ?? [])
      .map((tool) => tool.id)
      .join('|');

    useEffect(() => {
      setDismissedToolIds([]);
    }, [toolIdsSignature]);

    const visibleTools = useMemo(() => {
      const tools = toolsMenuItems ?? [];
      if (!canRemoveTools) return tools;
      return tools.filter(
        (tool) => tool.isSelected || !dismissedToolIds.includes(tool.id),
      );
    }, [toolsMenuItems, dismissedToolIds, canRemoveTools]);

    const handleToolDismiss = useCallback(
      (toolId: string) => {
        setDismissedToolIds((prev) =>
          prev.includes(toolId) ? prev : [...prev, toolId],
        );
        const tool = toolsMenuItems?.find((item) => item.id === toolId);
        if (tool?.isSelected) onToolToggle?.(toolId);
      },
      [toolsMenuItems, onToolToggle],
    );

    const hasModelSelected =
      deployments === undefined || selectedDeploymentId != null;
    const shouldShowMicButton = isAudioMessageSupported && !isStreaming;

    const handleSend = async () => {
      if (isSendDisabled || isVoiceActive) return;
      if (message.length >= maxMessageLength) {
        onMessageTooLong?.(message.length, maxMessageLength);
        return;
      }

      const currentMessage = message;
      const currentAttachments = attachments;
      setMessage('');
      historyNav.reset();
      try {
        await onSend?.(currentMessage, currentAttachments);
        currentAttachments.forEach((a) => {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
          if (a.playUrl) URL.revokeObjectURL(a.playUrl);
        });
        resetAttachments([]);
      } catch {
        setMessage(currentMessage);
        resetAttachments(currentAttachments);
      }
    };

    const isSendGesture = (e: KeyboardEvent<HTMLTextAreaElement>) =>
      sendOnEnter === SendOnEnter.MetaEnter
        ? (e.metaKey || e.ctrlKey) && !e.shiftKey
        : !e.shiftKey && !e.metaKey && !e.ctrlKey;

    /*
     * The open command menu behaves as a list autocomplete, so it takes the
     * keys an autocomplete owns before the textarea's own handling: the
     * arrows move the active option instead of navigating message history
     * (the trigger word is single-line, so there is no line to move to), and
     * Enter takes the active option instead of sending the message — with no
     * option active it does nothing rather than send. Shift+Enter and, in
     * MetaEnter mode, a bare Enter with nothing active keep inserting a
     * newline, which closes the menu. Escape is handled here, not left to the
     * `Dropdown`'s own floating-ui dismissal, so it can call the latching
     * `dismiss()` and stop the event before it also reaches floating-ui's
     * listener and gets folded into the *non*-latching outside-press path
     * (`onOpenChange` below). Returns whether the key was consumed.
     */
    const handleCommandMenuKeyDown = (
      e: KeyboardEvent<HTMLTextAreaElement>,
    ): boolean => {
      if (!isMenuOpen || e.nativeEvent.isComposing) return false;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
        return true;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveActiveCommandOption(
          e.key === 'ArrowDown'
            ? CommandMenuOptionStep.Next
            : CommandMenuOptionStep.Previous,
        );
        return true;
      }

      if (e.key !== 'Enter' || e.shiftKey) return false;

      const activeOption = getActiveCommandOption();
      if (activeOption != null) {
        e.preventDefault();
        activeOption.click();
        return true;
      }

      if (isSendGesture(e)) {
        e.preventDefault();
        return true;
      }

      return false;
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isVoiceActive) return;
      /* Serves the undo owed by an insertion the browser could not put on its own
       undo stack; a no-op whenever the browser can undo the edit itself. */
      if (handleUndoKeyDown(e)) return;
      if (handleCommandMenuKeyDown(e)) return;
      if (!e.nativeEvent.isComposing && !isInputDisabled && !isStreaming) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const cursorPos = e.currentTarget.selectionStart ?? 0;
          const newValue = historyNav.navigate(
            e.key === 'ArrowUp' ? 'up' : 'down',
            message,
            cursorPos,
          );
          if (newValue !== null) {
            e.preventDefault();
            setMessage(newValue);
            return;
          }
        }

        /*
         * The whole-mention remove gesture: a Backspace with the caret
         * collapsed exactly at a tracked range's trailing boundary deletes the
         * entire range in one native edit (so it lands on the browser's own
         * undo stack) instead of the default single-character deletion.
         */
        if (
          e.key === 'Backspace' &&
          onBackspaceAtCaret != null &&
          e.currentTarget.selectionStart === e.currentTarget.selectionEnd &&
          e.currentTarget.selectionStart != null
        ) {
          const range = onBackspaceAtCaret(e.currentTarget.selectionStart);
          if (range != null) {
            e.preventDefault();
            const textarea = e.currentTarget;
            textarea.setSelectionRange(range.start, range.start + range.length);
            const deletedNatively =
              typeof document.execCommand === 'function' &&
              document.execCommand('delete', false);
            if (!deletedNatively) {
              const nextValue =
                message.slice(0, range.start) +
                message.slice(range.start + range.length);
              applyValueThroughReact(textarea, nextValue, range.start);
            }
            return;
          }
        }
      }

      const isEnterKey = e.key === 'Enter';
      if (!isEnterKey) return;

      if (isSendGesture(e)) {
        e.preventDefault();
        if (!isStreaming && canSend && hasModelSelected && !isInputDisabled) {
          handleSend();
        }
      }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const newAttachments = buildAttachments(files);
      // Reset so the same file can be picked again
      e.target.value = '';
      addAttachments(newAttachments);
    };

    const mirrorInsertions = useMemo(() => {
      const list: MirrorInsertion[] = [];
      if (markerOffset != null) {
        list.push({
          offset: markerOffset,
          node: (
            <span
              key="caret-marker"
              ref={caretMarkerRef}
              aria-hidden
              className="inline-block h-[1lh] w-0 align-text-top"
            />
          ),
        });
      }
      if (
        hasCommandEmptyQueryHint &&
        commandMenu != null &&
        triggerEnd != null
      ) {
        list.push({
          offset: triggerEnd,
          node: (
            <span
              key="command-hint"
              className={styles.commandHint}
              aria-hidden
              data-mirror-synthetic
            >
              {commandMenu.emptyQueryHint}
            </span>
          ),
        });
      }
      return list;
    }, [markerOffset, hasCommandEmptyQueryHint, commandMenu, triggerEnd]);

    /*
     * The mirror also renders while only synthetic insertions exist (the
     * caret marker / empty-query hint of an open `/query`), and the
     * textarea's native selection is hidden whenever it does — so the
     * replacement selection highlight must follow the same condition, not
     * just `hasActiveMentions` ([#9231](https://github.com/epam/ai-dial-chat/issues/9231)).
     */
    const isMirrorActive = hasActiveMentions || mirrorInsertions.length > 0;

    const { mirrorRef, selectionRects, updateSelectionRects } =
      useMentionSelectionMirror({ textareaRef, message, isMirrorActive });

    const textarea = (
      <textarea
        className={mergeClasses(
          styles.textarea,
          isMirrorActive && styles.textareaMentionMode,
          typography?.fontClassName || 'dial-body-paragraph-text',
          'relative z-0 max-h-[272px] w-full resize-none overflow-y-auto border-0 bg-transparent pe-1 ps-1 outline-none [field-sizing:content]',
          'disabled:cursor-not-allowed',
        )}
        ref={textareaRef}
        autoFocus={autoFocus}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          historyNav.notifyChange();

          const inputEvent =
            e.nativeEvent instanceof InputEvent ? e.nativeEvent : undefined;
          handleValueChange(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
            inputEvent?.isComposing ?? false,
          );
          onChange?.(e.target.value);
        }}
        onSelect={updateSelectionRects}
        onFocus={handleTextareaFocus}
        onClick={handleTextareaClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleTextareaKeyUp}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete={commandMenu == null ? undefined : 'list'}
        aria-controls={isMenuOpen ? commandMenuListboxId : undefined}
        aria-activedescendant={activeCommandOptionId ?? undefined}
        aria-hidden={hasActiveMentions ? true : undefined}
        disabled={isInputDisabled}
        readOnly={isVoiceActive}
        rows={1}
      />
    );

    /*
     * The command menu anchors to the trigger word's own on-screen position,
     * not to the textarea as a whole — the kit `Dropdown` wraps its
     * `children` in the actual floating-ui reference element, so that
     * element has to sit at `caretAnchor` rather than the textarea itself
     * (which, unlike the marker, sits fixed at the box's own top-left
     * regardless of where the trigger word is). `Dropdown` takes no `style`
     * prop, only `className`, so it cannot be positioned directly with a
     * computed pixel value — instead, a plain `<div>` this component fully
     * controls carries the inline `style` and is absolutely positioned at
     * `caretAnchor`; `Dropdown`'s own internal reference span, rendered as
     * that div's only child with no positioning of its own, lands in normal
     * flow at the div's origin, i.e. exactly at the caret. The real textarea
     * renders as a sibling instead of `Dropdown`'s child. `trigger={[]}`
     * keeps the controlled `open` prop the only opener, focus stays in the
     * textarea on open (`initialFocus={-1}`), and clicks inside the textarea
     * count as inside the menu (`outsidePressIgnoreRef`).
     * `matchReferenceWidth={false}` drops the kit's default min-width equal
     * to the (now zero-size) reference, so the overlay sizes to its content.
     */
    const commandMenuArea =
      commandMenu == null ? (
        textarea
      ) : (
        <>
          {textarea}
          <div
            aria-hidden
            className={mergeClasses(
              'pointer-events-none absolute',
              typography?.fontClassName || 'dial-body-paragraph-text',
            )}
            style={{ left: caretAnchor?.left ?? 0, top: caretAnchor?.top ?? 0 }}
          >
            <Dropdown
              open={isMenuOpen}
              onOpenChange={(isOpen) => {
                /*
                 * Escape is intercepted earlier (`handleCommandMenuKeyDown`,
                 * with `stopPropagation`) and never reaches this listener, so
                 * a `false` here is always an outside click — the
                 * non-latching close.
                 */
                if (!isOpen) closeOnOutsidePress();
              }}
              placement="top-start"
              trigger={[]}
              initialFocus={-1}
              matchReferenceWidth={false}
              outsidePressIgnoreRef={textareaRef}
              renderOverlay={() => {
                /*
                 * The wrapper is always rendered: its ref scopes the
                 * keyboard's option lookup to this menu. It becomes a
                 * labeled group only when the host names the menu region.
                 */
                const hasMenuLabel = commandMenu.menuLabel != null;
                return (
                  <div
                    ref={commandMenuOverlayRef}
                    role={hasMenuLabel ? 'group' : undefined}
                    aria-label={commandMenu.menuLabel}
                  >
                    {commandMenu.renderMenu({
                      query,
                      caretPosition: activeWordStart ?? 0,
                      close: handleCloseCommandMenu,
                      listboxId: commandMenuListboxId,
                      activeOptionId: activeCommandOptionId,
                    })}
                  </div>
                );
              }}
            >
              {/*
               * floating-ui's actual reference element — sized to match the
               * caret marker's box. See `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3b
               * (multi-skill-message-mentions).
               */}
              <span aria-hidden className="inline-block h-[1lh] w-0" />
            </Dropdown>
          </div>
        </>
      );

    const textareaArea = (
      <div
        ref={textareaAreaRef}
        // Bleeds 4px past each edge, canceling the ps-1/pe-1 below.
        className="relative -me-1 -ms-1 w-[calc(100%+8px)]"
      >
        {isMirrorActive && (
          <div
            ref={mirrorRef}
            className={mergeClasses(
              styles.textarea,
              typography?.fontClassName || 'dial-body-paragraph-text',
              // Bleed room for chip edges — see `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3a.
              'pointer-events-none absolute inset-0 z-10 max-h-[272px] w-full overflow-hidden whitespace-pre-wrap pe-1 ps-1 [overflow-wrap:anywhere]',
            )}
          >
            {renderHighlightedText(
              message,
              mentionRanges,
              mirrorInsertions,
              styles.mentionHighlight,
              styles.mentionHighlightUnsupported,
            )}
            {selectionRects.map((rect, index) => (
              <div
                key={`selection-${index}`}
                aria-hidden
                className="pointer-events-none absolute rounded-sm bg-control-accent-alpha-active"
                /*
                 * A measured pixel rect from `Range.getClientRects()` — see
                 * the `left`/`top` exception noted on `caretAnchor` above.
                 */
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>
        )}
        {commandMenuArea}
      </div>
    );

    /*
     * Shared between the normal footer and the voice bar's second row: same
     * menu, same file input, only its disabled state differs. Disabled while
     * a dictation/attachment recording is anything but actively Recording, so
     * it cannot be used to interrupt a pending transcription.
     */
    const attachButtonNode = hideAddButton ? undefined : (
      <AddAttachmentButton
        onAttachClick={
          hideAttachFile ? undefined : () => fileInputRef.current?.click()
        }
        attachLabel={attachLabel}
        addMenuTitle={addMenuTitle}
        menuTitle={menuTitle}
        menuCloseLabel={menuCloseLabel}
        style={cssVars}
        isDisabled={isInputDisabled || isVoiceActive}
        chatSettings={chatSettings}
        extraMenuItems={dialFileSystemMenuItem}
        onRecordVoice={
          isVoiceRecordingSupported &&
          isAttachmentsEnabled &&
          !isStreaming &&
          !isVoiceActive
            ? () => startRecording(VoiceRecordingMode.Attachment)
            : undefined
        }
        recordVoiceLabel={recordVoiceLabel}
        /*
         * The "Tools" submenu exists only to bring a dismissed chip
         * back. With removal off every chip is always on screen, so the
         * entry would be dead weight — and where tools are the menu's
         * only content, withholding them drops the `+` button entirely.
         */
        toolsMenuItems={canRemoveTools ? toolsMenuItems : undefined}
        onToolToggle={onToolToggle}
        toolsMenuTitle={toolsMenuTitle}
        toolsBackLabel={toolsBackLabel}
        menuOverlays={menuOverlays}
        getCaretPosition={() =>
          textareaRef.current?.selectionStart ?? message.length
        }
      />
    );

    /*
     * One line does not fit a phone, so the inline layout is desktop-only by
     * default and a host does not have to branch on viewport itself. An embed
     * whose composer is already wide below 1280px opts the narrower widths in
     * rather than reimplementing the layout.
     */
    const isInlineActionRow =
      actionRowLayout === ActionRowLayout.Inline &&
      (!isMobile || isInlineActionRowAllowedBelowDesktop);

    const addClusterNode = attachButtonNode && (
      <div
        className={mergeClasses('flex', CONVERSATION_INPUT_CLASS.addCluster)}
      >
        {attachButtonNode}
      </div>
    );

    const chipsNode = visibleTools.length > 0 && onToolToggle != null && (
      <div
        className={mergeClasses(
          'min-w-0 flex-1',
          CONVERSATION_INPUT_CLASS.toolsChips,
        )}
      >
        <ToolsChips
          items={visibleTools}
          onToolToggle={onToolToggle}
          onToolDismiss={handleToolDismiss}
          canRemove={canRemoveTools}
          removeLabel={toolsChipLabels?.removeLabel}
          stateOnLabel={toolsChipLabels?.stateOnLabel}
          stateOffLabel={toolsChipLabels?.stateOffLabel}
        />
      </div>
    );

    return (
      <div
        ref={containerRef}
        style={cssVars}
        className={mergeClasses(
          styles.wrapper,
          isInputDisabled && styles.wrapperDisabled,
          isInputDisabled && 'cursor-not-allowed',
          'flex w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border',
          'focus-within:outline focus-within:-outline-offset-1 active:outline active:-outline-offset-1',
          attachments.length > 6 ? 'py-4 ps-4' : 'p-4',
          className,
          CONVERSATION_INPUT_CLASS.wrapper,
        )}
      >
        {(prefixAttachments.length > 0 || attachments.length > 0) && (
          <AttachmentTray
            attachments={[...prefixAttachments, ...attachments]}
            onRemove={(id) => {
              if (prefixAttachments.some((a) => a.id === id)) {
                onRemovePrefixAttachment?.(id);
              } else {
                handleRemove(id);
              }
            }}
            onRetry={handleRetry}
            onExpand={handleExpand}
            labels={{
              removeLabel,
              retryLabel,
              uploadingLabel,
              expandLabel,
              clickLabel,
            }}
            styles={attachmentTray}
            onAttachmentClick={
              onAttachmentClick != null
                ? (id) => {
                    const found = [...prefixAttachments, ...attachments].find(
                      (a) => a.id === id,
                    );
                    if (found != null) onAttachmentClick(found);
                  }
                : undefined
            }
          />
        )}
        {!hideAddButton && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={fileAccept}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={handleFileChange}
          />
        )}
        {voiceError && (
          <ErrorText text={voiceError} className="min-w-0 break-words px-1" />
        )}
        {isVoiceActive && (
          <VoiceBar
            embedded
            state={voiceState}
            analyserNodeRef={analyserNodeRef}
            onStop={stopRecording}
            onDiscard={discardRecording}
            attachButton={attachButtonNode}
            stopLabel={stopRecordingLabel}
            discardLabel={discardRecordingLabel}
            processingLabel={transcribingLabel}
          />
        )}
        {!isVoiceActive && hideActionBar && textareaArea}
        {/*
         * Tool chips are variable-width, so in the inline layout they get their
         * own row above rather than competing with the textarea for the line.
         */}
        {!isVoiceActive && !hideActionBar && isInlineActionRow && chipsNode && (
          <div className="flex">{chipsNode}</div>
        )}
        {!isVoiceActive && !hideActionBar && (
          <div
            className={mergeClasses(
              'flex items-center gap-2',
              isInlineActionRow ? 'flex-nowrap' : 'flex-wrap',
              CONVERSATION_INPUT_CLASS.actionRow,
            )}
          >
            {/*
             * Both layouts render in visual order rather than reordering with
             * `order-*`, so the tab order always matches what is on screen.
             */}
            {isInlineActionRow && addClusterNode}
            <div
              className={mergeClasses(
                'flex min-w-0 items-center self-stretch',
                isInlineActionRow ? 'flex-1' : 'w-full',
                CONVERSATION_INPUT_CLASS.textareaWrap,
              )}
            >
              {textareaArea}
            </div>
            {!isInlineActionRow && addClusterNode}
            {!isInlineActionRow && chipsNode}
            <div
              className={mergeClasses(
                'ms-auto flex flex-shrink-0 items-center gap-2',
                CONVERSATION_INPUT_CLASS.footerActions,
              )}
            >
              {renderFooterActions ? (
                renderFooterActions({ canSend, onSend: handleSend })
              ) : (
                <>
                  {usageLimitsSlot}
                  <ModelSelectorControl
                    deployments={deployments}
                    selectedDeploymentId={selectedDeploymentId}
                    onDeploymentChange={onDeploymentChange}
                    modelSelectorLabels={modelSelectorLabels}
                    menuStyles={modelMenu}
                    isStreaming={isStreaming}
                    isMobile={isMobile}
                    isDisabled={isModelSelectorDisabled}
                    style={cssVars}
                    modelPickerOverlay={modelPickerOverlay}
                    isPickerOpen={isPickerOpen}
                    onPickerToggle={() => setIsPickerOpen((prev) => !prev)}
                    onPickerOpenChange={setIsPickerOpen}
                  />
                  {shouldShowMicButton && (
                    <GhostIconButton
                      icon={
                        <IconMicrophone
                          size={DIAL_ICON_SIZE.LG}
                          stroke={DIAL_KIT_ICON_STROKE}
                          aria-hidden
                        />
                      }
                      aria-label={micLabel}
                      tooltipProps={{ tooltip: micLabel }}
                      className="size-[40px] flex-shrink-0 mobile:min-h-11 mobile:min-w-11"
                      onClick={() =>
                        startRecording(VoiceRecordingMode.Dictation)
                      }
                      disabled={isInputDisabled || isStreaming}
                    />
                  )}
                  {isStreaming && onStop ? (
                    <StopButton onStop={onStop} ariaLabel={stopLabel} />
                  ) : (
                    !isStreaming && (
                      <SendButton
                        onSend={handleSend}
                        isDisabled={!hasModelSelected || !canSend}
                        ariaLabel={sendLabel}
                        sendTooltip={
                          hasSendableContent
                            ? sendTooltip
                            : (emptyMessageTooltip ?? sendTooltip)
                        }
                      />
                    )
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span key={latestTranscript.revision}>{latestTranscript.text}</span>
        </span>
      </div>
    );
  },
);

Input.displayName = 'Input';
