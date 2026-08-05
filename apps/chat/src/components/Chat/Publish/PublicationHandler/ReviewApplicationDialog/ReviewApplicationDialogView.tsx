import { IconPencilMinus } from '@tabler/icons-react';
import { Fragment, useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationType,
  getLocalizedEntityIdName,
  getModelDescription,
  getModelName,
  isExecutableApp,
  isQuickApp2,
} from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors, UISelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';

import { PublicationControls } from '@/src/components/Chat/Publish/PublicationControls/PublicationControls';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { IconButton } from '@/src/components/Common/IconButton';
import { MarketplaceEntityTopic } from '@/src/components/Marketplace/MarketplaceEntityTopic';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';
import { ReviewCodeAppSection } from './ReviewCodeAppSection';
import { ReviewExternalAppSection } from './ReviewExternalAppSection';
import { ReviewQuickApp2Section } from './ReviewQuickApp2Section';
import { ReviewQuickAppSection } from './ReviewQuickAppSection';

import isEmpty from 'lodash-es/isEmpty';

interface ReviewApplicationDialogViewProps {
  application: CustomApplicationModel;
}

export function ReviewApplicationDialogView({
  application,
}: ReviewApplicationDialogViewProps) {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const locale = useAppSelector(UISelectors.selectLocale);
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const isResourceUnpublishing = useAppSelector((state) =>
    PublicationSelectors.selectIsResourceUnpublishing(
      state,
      selectedPublicationUrl ?? '',
      application.id,
    ),
  );

  const isCodeApp = isExecutableApp(application);
  const isQuickAppTwo = isQuickApp2(application);
  const description = getModelDescription(application, locale);

  const controlsEntity = useMemo(
    () => ({
      id: ApiUtils.decodeApiUrl(application.id),
      name: getLocalizedEntityIdName(application.name),
      folderId: getFolderIdFromEntityId(application.id),
    }),
    [application.id, application.name],
  );

  const handleEditApplication = useCallback(() => {
    const applicationType = getApplicationType(application);
    dispatch(
      ApplicationActions.enterEditMode({
        entity: application,
        applicationType,
        publicationUrl: selectedPublicationUrl as string,
      }),
    );
    dispatch(PublicationActions.setIsApplicationReview(false));
  }, [application, dispatch, selectedPublicationUrl]);

  const featuresValue =
    !isCodeApp && !isQuickAppTwo && !isEmpty(application.features)
      ? Object.entries(application.features ?? {}).map(
          ([key, value], index, array) => (
            <Fragment key={key}>
              {`"${key}" : "${value}"${index !== array.length - 1 ? ',\n' : ''}`}
            </Fragment>
          ),
        )
      : null;

  const attachmentTypesValue = !isEmpty(application.inputAttachmentTypes) ? (
    <div className="flex flex-wrap">
      {application.inputAttachmentTypes?.map((item) => (
        <span
          key={item}
          className="m-1 items-center justify-between gap-2 rounded bg-accent-primary-alpha px-2 py-1.5"
          data-qa="app-attach-type"
        >
          {item}
        </span>
      ))}
    </div>
  ) : null;

  const completionUrl =
    application.completionUrl && isEmpty(application.function?.mapping)
      ? application.completionUrl
      : null;

  return (
    <>
      <div className="flex flex-col gap-2 overflow-auto px-3 py-4 text-sm md:p-6">
        <h2 className="text-base font-semibold">
          {`${isResourceUnpublishing ? t(ChatI18nKeys.Unpublish) : t(ChatI18nKeys.Publish)} ${t(ChatI18nKeys.Application)}`}
        </h2>

        <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Name)}
            value={getModelName(application, locale)}
            dataQa="entity-name"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Version)}
            value={application.version ?? NA_VERSION}
            dataQa="entity-version"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Icon)}
            value={
              <ModelIcon
                entity={application}
                entityId={application.id}
                size={60}
                isTooltipDisabled
              />
            }
            valueClassName=""
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Description)}
            value={description}
            dataQa="entity-description"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Topics)}
            value={
              application.topics?.length ? (
                <div className="flex flex-wrap gap-1">
                  {application.topics.map((topic) => (
                    <MarketplaceEntityTopic key={topic} topic={topic} />
                  ))}
                </div>
              ) : null
            }
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.FeaturesData)}
            value={featuresValue}
            dataQa="app-feature"
            valueClassName="max-w-[414px] whitespace-pre-wrap leading-5 text-primary break-all"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.AttachmentTypes)}
            value={attachmentTypesValue}
            valueClassName="max-w-[414px]"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.MaxAttachmentsNumber)}
            value={application.maxInputAttachments}
            dataQa="app-max-attach"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.CompletionUrl)}
            value={completionUrl}
            dataQa="app-completion-url"
            valueClassName="max-w-[414px] break-all text-primary"
          />

          <ReviewCodeAppSection application={application} />
          <ReviewQuickAppSection application={application} />
          <ReviewQuickApp2Section application={application} />
          <ReviewExternalAppSection application={application} />
        </div>
      </div>

      <div
        className={classNames(
          'flex w-full items-center border-t border-tertiary px-3 py-4 md:px-5',
          isResourceUnpublishing ? 'justify-end' : 'justify-between',
        )}
      >
        {!isResourceUnpublishing && (
          <IconButton
            name={t(ChatI18nKeys.EditApplication)}
            dataQa="admin-edit-application"
            Icon={IconPencilMinus}
            onClick={handleEditApplication}
          />
        )}
        <PublicationControls
          entity={controlsEntity}
          controlsClassNames="text-sm"
        />
      </div>
    </>
  );
}
