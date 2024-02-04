import { KeyboardEvent, useCallback, useMemo, useState } from 'react';

import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

/**
 * Custom hook for managing prompt selection in a chat interface.
 * @param maxLength The maximum length of the prompt.
 * @returns An object containing control functions and states.
 */
export const usePromptSelection = (maxLength: number) => {
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);

  const [promptInputValue, setPromptInputValue] = useState('');
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [content, setContent] = useState<string>('');
  const [isPromptLimitModalOpen, setIsPromptLimitModalOpen] = useState(false);
  const [showPromptList, setShowPromptList] = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const filteredPrompts = useMemo(
    () =>
      prompts.filter((prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
      ),
    [prompts, promptInputValue],
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
   * Parses a string for variables in the {{variable}} format and extracts them.
   * @param content The string to be parsed.
   * @returns An array of found variables.
   */
  const parseVariables = useCallback((content: string) => {
    const regex = /{{(.*?)}}/g;
    const foundVariables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      foundVariables.push(match[1]);
    }

    return foundVariables;
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

      const parsedVariables = parseVariables(prompt.content);
      setVariables(parsedVariables);

      if (parsedVariables.length > 0) {
        setIsModalVisible(true);
      } else {
        setContent((prevContent) =>
          prevContent?.replace(/\/\w*$/, prompt.content as string),
        );
        updatePromptListVisibility(prompt.content);
      }
    },
    [parseVariables, updatePromptListVisibility],
  );

  /**
   * Initiates the modal process based on the selected prompt.
   * Checks if the selected prompt content is within the maximum length and updates the content state.
   */
  const handleInitModal = useCallback(() => {
    const selectedPrompt = filteredPrompts[activePromptIndex]
      ? filteredPrompts[activePromptIndex]
      : undefined;

    if (!selectedPrompt?.content) {
      setShowPromptList(false);
      return;
    }
    if (selectedPrompt.content.length > maxLength) {
      setIsPromptLimitModalOpen(true);
      return;
    }

    setContent((prevVal) =>
      prevVal?.replace(/\/\w*$/, selectedPrompt.content!),
    );
    handlePromptSelect(selectedPrompt);
    setShowPromptList(false);
  }, [activePromptIndex, filteredPrompts, handlePromptSelect, maxLength]);

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
        handleInitModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPromptList(false);
      } else {
        setActivePromptIndex(0);
      }
    },
    [handleInitModal, prompts.length, setActivePromptIndex, setShowPromptList],
  );

  return {
    setActivePromptIndex,
    activePromptIndex,
    isPromptLimitModalOpen,
    setIsPromptLimitModalOpen,
    setContent,
    setIsModalVisible,
    showPromptList,
    setShowPromptList,
    isModalVisible,
    content,
    updatePromptListVisibility,
    handleInitModal,
    filteredPrompts,
    variables,
    handleKeyDownIfShown,
  };
};
