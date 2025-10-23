import { IconKey } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { Checkbox } from '@/src/components/Common/Checkbox';

interface Props {
  itemId: string;
  level: number;
}

export const PublicationCredentialsRow: React.FC<Props> = ({
  level,
  itemId,
}) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectedPublicationItems = useAppSelector(
    PublicationSelectors.selectSelectedPublicationItems,
  );
  const selectedCredentialsItems = useAppSelector(
    PublicationSelectors.selectSelectedCredentialsItems,
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
        publicationUrl: selectedPublication?.url ?? '',
        ids: [itemId],
      }),
    );

    if (
      !selectedCredentialsItems.includes(itemId) &&
      !selectedPublicationItems.includes(itemId)
    ) {
      dispatch(
        PublicationActions.selectPublicationItems({
          publicationUrl: selectedPublication?.url ?? '',
          ids: [itemId],
        }),
      );
    }
  }, [
    dispatch,
    selectedPublication?.url,
    itemId,
    selectedCredentialsItems,
    selectedPublicationItems,
  ]);

  return (
    <div className="mt-1 flex items-center justify-between rounded pr-2 hover:bg-accent-primary-alpha focus:bg-accent-primary-alpha">
      <span
        className="relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center gap-2 truncate rounded px-4"
        style={{
          paddingLeft: `${level * 24 + 16}px`,
        }}
        data-qa="credentials"
      >
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          className="mr-0"
        />
        <IconKey size={18} className="text-secondary" />
        <p>{t('Credentials')}</p>
      </span>
    </div>
  );
};
