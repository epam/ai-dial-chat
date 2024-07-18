import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import { NonModelButton } from '../Common/NonModelButton';
import { ReplayAsIsIcon } from './ReplayAsIsIcon';

interface Props {
  selected: boolean;
  onSelect: (entityId: string) => void;
}

export const ReplayAsIsButton = ({ selected, onSelect }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const handleOnSelect = useCallback(() => {
    if (!selected) {
      onSelect(REPLAY_AS_IS_MODEL);
    }
  }, [onSelect, selected]);

  return (
    <NonModelButton
      onClickHandler={handleOnSelect}
      icon={<ReplayAsIsIcon />}
      buttonLabel={t('Replay as is')}
      isSelected={selected}
    />
  );
};
