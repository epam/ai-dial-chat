import { FC, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getIdWithoutFeatureType } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { AuthSelectors, PublicationSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { RuleListItem } from '@/src/components/Chat/Publish/RuleListItem';
import { Spinner } from '@/src/components/Common/Spinner';

import { FeatureType } from '@epam/ai-dial-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface ApplicationPublishInfoProps {
  entity: DialAIEntityModel;
}

const ApplicationPublishInfoView: FC<ApplicationPublishInfoProps> = ({
  entity,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const parentPath = getIdWithoutFeatureType(
    getFolderIdFromEntityId(entity.id),
  );
  const publishedTo = parentPath.replace(/^[^/]+/, 'Organization');

  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, parentPath),
  );
  const rulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );

  const isThereRules = useMemo(
    () => Object.values(rules).some((r) => !!r.length),
    [rules],
  );

  if (rulesLoading) {
    return (
      <div className="flex justify-center px-3 py-4 md:px-6">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-3 py-4 md:px-6">
      <h3 className="text-base font-semibold text-primary">
        {t(MarketplaceI18nKeys.PublicationDetails)}
      </h3>
      <div className="flex flex-col gap-2 truncate">
        <h4 className="text-sm font-semibold text-primary">
          {t(MarketplaceI18nKeys.PublishedTo)}
        </h4>
        <DialEllipsisTooltip
          text={publishedTo}
          className="truncate text-sm text-primary"
        />
      </div>

      {isThereRules && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-primary">
            {t(MarketplaceI18nKeys.AllowAccessIfAllMatch)}
          </h4>

          <div className="flex flex-col">
            {Object.entries(rules).map(([path, rules]) => (
              <RuleListItem key={path} path={path} rules={rules} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ApplicationPublishInfo: FC<ApplicationPublishInfoProps> = ({
  entity,
}) => {
  const dispatch = useAppDispatch();

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const isPublic = isEntityIdPublic(entity, FeatureType.Application);
  const parentPath = splitEntityId(entity.id).parentPath;

  useEffect(() => {
    if (isPublic && isAdmin && parentPath) {
      dispatch(PublicationActions.uploadRules({ path: parentPath }));
    }
  }, [parentPath, dispatch, isPublic, isAdmin]);

  if (!isAdmin || !isPublic) return null;

  return <ApplicationPublishInfoView entity={entity} />;
};
