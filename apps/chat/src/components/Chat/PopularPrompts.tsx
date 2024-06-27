import { IconBulb } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialAIEntityModel } from '@/src/types/models';
import { PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { NUMBER_OF_POPULAR_PROMPTS_TO_DISPLAY } from '@/src/constants/chat';

import { take } from 'lodash';

interface PopularPromptProps {
  item: PromptInfo;
  onPromptClick: (promptId: string) => void;
}

export const PopularPrompt = ({
  item: prompt,
  onPromptClick,
}: PopularPromptProps) => (
  <div
    className={classNames(
      'rounded-secondary flex h-[110px] w-[150px] cursor-pointer flex-col items-center overflow-hidden border border-secondary bg-layer-2 px-4 py-2 shadow-primary hover:border-tertiary',
    )}
    onClick={() => onPromptClick(prompt.id)}
    data-qa="popular-prompt"
  >
    <div className="mt-2 flex size-full flex-col items-start">
      <IconBulb className="text-secondary-bg-dark" size={18} />
      <p className="overflow-hidden overflow-ellipsis py-2 text-left text-xs">
        {prompt.name}
      </p>
    </div>
  </div>
);

export const PopularPrompts = ({ model }: { model: DialAIEntityModel }) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const popularPrompts = useAppSelector(PromptsSelectors.selectPopularPrompts);
  const popularPromptsPaths =
    useAppSelector(SettingsSelectors.selectPopularPromptsPaths) || {};
  const promptsPath = popularPromptsPaths[model.id];

  useEffect(() => {
    if (!promptsPath) return;

    dispatch(PromptsActions.uploadPopularPrompts({ promptsPath }));
  }, [dispatch, promptsPath]);

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

  if (!promptsPath) return null;

  return (
    <div className="flex flex-col gap-5 px-3">
      <div className="text-center font font-medium md:text-left">
        {t('Our most popular prompts (questions):')}
      </div>
      <div className="flex flex-wrap justify-center gap-10">
        {take(popularPrompts, NUMBER_OF_POPULAR_PROMPTS_TO_DISPLAY).map(
          (prompt) => (
            <div key={prompt.id}>
              <PopularPrompt item={prompt} onPromptClick={onPromptClick} />
            </div>
          ),
        )}
      </div>
    </div>
  );
};
