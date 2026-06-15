import { IconKey } from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Checkbox } from '@/src/components/Common/Checkbox';

import { PublicationItemProps } from './view-props';

export const PublicationCredentialsRow: React.FC<PublicationItemProps> = ({
  level,
  item: { id: itemId },
  publicationUrl,
}) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publicationUrl),
  );
  const selectedCredentialsItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedCredentialsItems(state, publicationUrl),
  );

  const isSelected = useMemo(
    () =>
      selectedPublicationItems.includes(itemId) &&
      selectedCredentialsItems.includes(itemId),
    [itemId, selectedPublicationItems, selectedCredentialsItems],
  );

  const handleSelect = useCallback(() => {
    dispatch(
      PublicationActions.selectCredentialsItems({
        publicationUrl,
        ids: [itemId],
      }),
    );

    if (
      !selectedCredentialsItems.includes(itemId) &&
      !selectedPublicationItems.includes(itemId)
    ) {
      dispatch(
        PublicationActions.selectPublicationItems({
          publicationUrl,
          ids: [itemId],
        }),
      );
    }
  }, [
    dispatch,
    publicationUrl,
    itemId,
    selectedCredentialsItems,
    selectedPublicationItems,
  ]);

  return (
    <div className="mt-1 flex items-center justify-between rounded pe-2 hover:bg-accent-primary-alpha focus:bg-accent-primary-alpha">
      <span
        className="relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center gap-2 truncate rounded px-4"
        style={{
          paddingInlineStart: `${level * 24 + 16}px`,
        }}
        data-qa="credentials"
      >
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          className="me-0"
        />
        <IconKey size={18} className="text-secondary" />
        <p>{t(ChatI18nKeys.Credentials)}</p>
      </span>
    </div>
  );
};
