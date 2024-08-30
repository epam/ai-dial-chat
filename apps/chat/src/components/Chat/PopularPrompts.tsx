import { IconBulb } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { DialAIEntityModel } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import {
  HR_BUDDY_PERSONAS,
  HR_BUDDY_PERSONAS_DISPLAYING_ORDER,
  ModelId,
  NUMBER_OF_POPULAR_PROMPTS_TO_DISPLAY,
} from '@/src/constants/chat';

import Loader from '@/src/components/Common/Loader';

import { EmployeeIcon, HRIcon, ManagerIcon } from '@/src/icons';
import { sortBy, take } from 'lodash';

interface PopularPromptProps {
  item: Prompt;
  selectedPromptId?: string | undefined;
  onPromptClick: (promptId: string) => void;
}

export const PopularPrompt = ({
  item: prompt,
  onPromptClick,
}: PopularPromptProps) => (
  <div
    className={classNames(
      'flex h-[110px] w-[150px] cursor-pointer flex-col items-center overflow-hidden rounded-secondary border border-secondary bg-layer-2 px-4 py-2 shadow-primary hover:border-tertiary',
    )}
    onClick={() => onPromptClick(prompt.id)}
    data-qa="popular-prompt"
  >
    <div className="mt-5 flex size-full flex-col items-start">
      <IconBulb className="text-secondary-bg-dark" size={24} />
      <p className="overflow-hidden text-ellipsis pt-1 text-left text-xs">
        {prompt.name}
      </p>
    </div>
  </div>
);

export const PersonaPrompt = ({
  item: persona,
  onPromptClick,
  selectedPromptId = '',
}: PopularPromptProps) => {
  const PersonaIcon = useMemo(
    () =>
      persona.name === HR_BUDDY_PERSONAS.Employee
        ? EmployeeIcon
        : persona.name === HR_BUDDY_PERSONAS.Manager
          ? ManagerIcon
          : HRIcon,
    [persona.name],
  );

  const shouldHidePersona = useMemo(
    () =>
      (Object.values(HR_BUDDY_PERSONAS) as string[]).some((item) =>
        selectedPromptId.includes(item),
      ) && selectedPromptId !== persona.id,
    [persona.id, selectedPromptId],
  );

  return (
    <div
      className={classNames(
        'flex h-[125px] w-[150px] cursor-pointer flex-col items-center overflow-hidden rounded-secondary border border-secondary bg-layer-2 px-2.5 py-2 shadow-primary hover:border-tertiary',
        shouldHidePersona && 'opacity-50',
        selectedPromptId === persona.id && 'opacity-100',
      )}
      onClick={() => onPromptClick(persona.id)}
      data-qa="popular-prompt"
    >
      <div className="flex size-full flex-col items-start">
        <div className="flex h-[50%] items-center gap-2 pl-2">
          <PersonaIcon />
          <span className="text-xs font-medium">{persona.name}</span>
        </div>
        <div className="mt-1 flex h-[50%] items-center border-t border-t-pr-grey-200">
          <p className="overflow-hidden text-ellipsis text-left text-xxs leading-4">
            {persona.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export const PopularPrompts = ({ model }: { model: DialAIEntityModel }) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const { locale } = useRouter();

  const popularPrompts = useAppSelector(PromptsSelectors.selectPopularPrompts);
  const popularPromptsPaths =
    useAppSelector(SettingsSelectors.selectPopularPromptsPaths) || {};
  const selectedPromptPopularId = useAppSelector(
    PromptsSelectors.selectSelectedPopularPromptId,
  );
  const chatInputContent = useAppSelector(
    ConversationsSelectors.selectChatInputContent,
  );
  const popularPromptsIsLoading = useAppSelector(
    PromptsSelectors.selectPopularPromptsIsLoading,
  );
  const sortedPopularPrompts = useMemo(
    () =>
      sortBy(
        popularPrompts,
        model.id === ModelId.HR_BUDDY
          ? (prompt) => HR_BUDDY_PERSONAS_DISPLAYING_ORDER[prompt.name]
          : 'name',
      ),
    [model.id, popularPrompts],
  );
  const promptsPath = popularPromptsPaths[model.id];

  const clearChatInputContent = (modelId: string) => {
    if (modelId === ModelId.HR_BUDDY) {
      dispatch(ConversationsActions.shouldClearChatInputContent(true));
    }
  };

  useEffect(() => {
    if (chatInputContent === '') {
      dispatch(PromptsActions.setPopularPromptId({ id: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatInputContent]);

  useEffect(() => {
    if (!promptsPath) return;

    dispatch(
      PromptsActions.uploadPopularPrompts({
        promptsPath: `${promptsPath}/${locale}`,
      }),
    );
    clearChatInputContent(model.id);

    return () => {
      dispatch(PromptsActions.setSelectedPrompt({ promptId: '' }));
      clearChatInputContent(model.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, promptsPath, model.id, locale]);

  const onPromptClick = useCallback(
    (promptId: string) => {
      dispatch(PromptsActions.setSelectedPrompt({ promptId }));
      dispatch(PromptsActions.setIsPromptContentCopying(true));
      dispatch(
        PromptsActions.uploadPrompt({
          promptId,
        }),
      );
    },
    [dispatch],
  );

  if (!promptsPath || !popularPrompts.length) return null;

  if (popularPromptsIsLoading) return <Loader />;

  return (
    <div className="flex flex-col gap-5 px-3">
      <div
        className={classNames(
          'text-center font',
          model.id === ModelId.HR_BUDDY
            ? 'text-xs font-bold text-pr-primary-550 md:text-center'
            : 'font-medium md:text-left',
        )}
      >
        {model.id === ModelId.HR_BUDDY
          ? t('chat.common.select_your_persona.label')
          : t('chat.common.most_popular_prompts.text')}
      </div>
      <div className="flex flex-wrap justify-center gap-10">
        {take(sortedPopularPrompts, NUMBER_OF_POPULAR_PROMPTS_TO_DISPLAY).map(
          (prompt) => (
            <div key={prompt.id}>
              {model.id === ModelId.HR_BUDDY ? (
                <PersonaPrompt
                  item={prompt}
                  onPromptClick={onPromptClick}
                  selectedPromptId={selectedPromptPopularId}
                />
              ) : (
                <PopularPrompt item={prompt} onPromptClick={onPromptClick} />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
};
