import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';

import { parseVariablesFromContent } from '../utils/app/prompts';

import { DialAIEntityModel } from '../types/models';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { useTokenizer } from './useTokenizer';

/**
 * Custom hook for managing prompt selection in a chat interface.
 * @param maxTokensLength The maximum tokens length of the prompt.
 * @param tokenizer: tokenizer object which used for tokens calculations.
 * @param prompt Default prompt value.
 * @param onChangePrompt A function to call if prompt selected.
 * @returns An object containing control functions and states.
 */

export const usePromptSelection = (
  maxTokensLength: number,
  tokenizer: DialAIEntityModel['tokenizer'],
  prompt: string,
  onChangePrompt?: (prompt: string) => void,
) => {
  const { getTokensLength } = useTokenizer(tokenizer);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);

  const dispatch = useDispatch();

  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);

  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [content, setContent] = useState<string>(prompt);
  const addPromptContent = useCallback((newContent: string) => {
    setContent((prevContent) => prevContent?.replace(/\/\w*$/, newContent));
  }, []);
  const [isPromptLimitModalOpen, setIsPromptLimitModalOpen] = useState(false);
  const [showPromptList, setShowPromptList] = useState(false);
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const filteredPrompts = useMemo(
    () =>
      prompts.filter((prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
      ),
    [prompts, promptInputValue],
  );

  const selectedPromptRef = useRef(
    filteredPrompts[0] ? filteredPrompts[0] : undefined,
  );

  /**
   * Updates the visibility of the prompt list based on the user's input text.
   * @param text The text entered by the user.
   */
  const updatePromptListVisibility = useCallback((text: string) => {
    const match = text.match(/\/\w*$/);

    if (match) {
      setShowPromptList(true);
      setPromptInputValue(match[0].slice(1));
    } else {
      setShowPromptList(false);
      setPromptInputValue('');
    }
  }, []);

  /**
   * Handles the selection of a prompt by the user.
   * @param prompt The selected prompt.
   */
  const handlePromptSelect = useCallback(
    (prompt: Prompt) => {
      if (!prompt.content) {
        return;
      }

      const parsedVariables = parseVariablesFromContent(prompt.content);

      if (parsedVariables.length > 0) {
        setIsModalVisible(true);
      } else {
        addPromptContent(prompt.content);
        updatePromptListVisibility(prompt.content);
      }
    },
    [addPromptContent, updatePromptListVisibility],
  );

  /**
   * Initiates the modal process based on the selected prompt.
   * Checks if the selected prompt content is within the maximum length and updates the content state.
   */
  const handleInitModal = useCallback(() => {
    const selectedPrompt = selectedPromptRef.current as Prompt | undefined;

    if (!selectedPrompt?.content) {
      setShowPromptList(false);
      return;
    }

    const tokenLength = getTokensLength(selectedPrompt.content);
    const contentLength = getTokensLength(content);
    if (tokenLength + contentLength > maxTokensLength) {
      setIsPromptLimitModalOpen(true);
      return;
    }

    handlePromptSelect(selectedPrompt);
    if (onChangePrompt) {
      onChangePrompt(content.replace(/\/\w*$/, selectedPrompt.content!));
    }
    setShowPromptList(false);
  }, [
    content,
    getTokensLength,
    handlePromptSelect,
    maxTokensLength,
    onChangePrompt,
  ]);

  /**
   * Resets the request sending state and update the currently selected prompt,
   * then call the modal window initialization function.
   */
  useEffect(() => {
    if (!isLoading && isRequestSent) {
      setIsRequestSent(false);
      selectedPromptRef.current = filteredPrompts[activePromptIndex]
        ? filteredPrompts[activePromptIndex]
        : undefined;

      handleInitModal();
    }
  }, [
    activePromptIndex,
    filteredPrompts,
    handleInitModal,
    isLoading,
    isRequestSent,
  ]);

  /**
   * Handles key down events when the prompt list is shown.
   * Manages navigation (up, down, enter, escape) within the prompt list.
   * @param e The keyboard event.
   */
  const handleKeyDownIfShown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : prevIndex,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : prevIndex,
        );
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : 0,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsRequestSent(true);
        dispatch(
          PromptsActions.uploadPrompt({
            promptId: filteredPrompts[activePromptIndex].id,
          }),
        );
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPromptList(false);
      } else {
        setActivePromptIndex(0);
      }
    },
    [activePromptIndex, dispatch, filteredPrompts, prompts.length],
  );

  /**
   * Initializes the prompt loads.
   */
  const getPrompt = useCallback(() => {
    setIsRequestSent(true);
    dispatch(
      PromptsActions.uploadPrompt({
        promptId: filteredPrompts[activePromptIndex].id,
      }),
    );
  }, [activePromptIndex, dispatch, filteredPrompts]);

  return {
    setActivePromptIndex,
    activePromptIndex,
    isPromptLimitModalOpen,
    setIsPromptLimitModalOpen,
    setContent,
    addPromptContent,
    setIsModalVisible,
    showPromptList,
    setShowPromptList,
    isModalVisible,
    content,
    updatePromptListVisibility,
    filteredPrompts,
    handleKeyDownIfShown,
    isRequestSent,
    getPrompt,
    isLoading: isLoading && isRequestSent,
  };
};
