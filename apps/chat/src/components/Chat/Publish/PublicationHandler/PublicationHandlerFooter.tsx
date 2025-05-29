import { IconExclamationCircle, IconPencil } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getFolderIdFromEntityId,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';
import {
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
} from '@/src/utils/app/id';

import { Publication, ResourceToReview } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ConversationsActions,
  PromptsActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import {
  ConversationsSelectors,
  PromptsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { IconButton } from '@/src/components/Common/IconButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { FeatureType } from '@epam/ai-dial-shared';
import { uniq } from 'lodash-es';

interface Props {
  publication: Publication;
}

const getFirstReviewUrl = (
  resourcesToReview: ResourceToReview[],
  reviewedResources: ResourceToReview[],
) => {
  return resourcesToReview.length
    ? resourcesToReview[0].reviewUrl
    : reviewedResources[0].reviewUrl;
};

const getReviewItems = (
  publication: Publication,
  resourcesToReview: ResourceToReview[],
  isItemId: (id: string) => boolean,
) => {
  const toReview = resourcesToReview.filter(
    (r) =>
      !r.reviewed &&
      r.publicationUrl === publication.url &&
      isItemId(r.reviewUrl),
  );
  const reviewed = resourcesToReview.filter(
    (r) => r.publicationUrl === publication.url && isItemId(r.reviewUrl),
  );

  return { toReview, reviewed };
};

const isEditMode = false;

export function PublicationHandlerFooter({ publication }: Props) {
  const { t } = useTranslation(Translation.Chat);

  const files = useAppSelector(FilesSelectors.selectFiles);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const applications = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );
  const resourcesToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourcesToReviewByPublicationUrl(
      state,
      publication.url,
    ),
  );

  const dispatch = useAppDispatch();

  const notExistEntities = useMemo(
    () =>
      [...files, ...conversations, ...prompts, ...applications].filter(
        (entity) => entity.publicationInfo?.isNotExist,
      ),
    [conversations, files, prompts, applications],
  );

  useEffect(() => {
    // we do not need to review files
    const resourcesToReview = publication.resources.filter(
      (resource) => !isFileId(resource.targetUrl),
    );
    const resourcesToReviewIds = resourcesToReview.map(
      (resource) => resource.reviewUrl,
    );
    const notExistEntitiesIds = notExistEntities.map((entity) => entity.id);
    const isSomeResourceNotExist = resourcesToReviewIds.some((id) =>
      notExistEntitiesIds.includes(id),
    );

    if (!isSomeResourceNotExist) {
      dispatch(
        PublicationActions.setPublicationsToReview({
          items: resourcesToReview.map((resource) => ({
            reviewed: false,
            reviewUrl: resource.reviewUrl,
            publicationUrl: publication.url,
          })),
        }),
      );
    }
  }, [dispatch, notExistEntities, publication.resources, publication.url]);

  const expandFoldersByFeatureType = useCallback(
    (
      toReview: ResourceToReview[],
      reviewed: ResourceToReview[],
      featureType: FeatureType,
    ) => {
      const paths = uniq(
        [...toReview, ...reviewed].flatMap((resource) =>
          getParentFolderIdsFromEntityId(
            getFolderIdFromEntityId(resource.reviewUrl),
          ).filter((id) => id !== resource.reviewUrl),
        ),
      );

      if (paths.length) {
        dispatch(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: paths,
            featureType,
          }),
        );
      }
    },
    [dispatch],
  );

  const handlePublicationReview = useCallback(() => {
    const { toReview: conversationsToReview, reviewed: reviewedConversations } =
      getReviewItems(publication, resourcesToReview, isConversationId);
    const { toReview: promptsToReview, reviewed: reviewedPrompts } =
      getReviewItems(publication, resourcesToReview, isPromptId);
    const { toReview: applicationsToReview, reviewed: reviewedApplications } =
      getReviewItems(publication, resourcesToReview, isApplicationId);

    const startConversationsReview = () => {
      expandFoldersByFeatureType(
        conversationsToReview,
        reviewedConversations,
        FeatureType.Chat,
      );
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [
            getFirstReviewUrl(conversationsToReview, reviewedConversations),
          ],
        }),
      );
    };

    const startApplicationsReview = () => {
      const applicationId = getFirstReviewUrl(
        applicationsToReview,
        reviewedApplications,
      );
      dispatch(ApplicationActions.get({ applicationId }));
      dispatch(PublicationActions.setIsApplicationReview(true));
    };

    const startPromptsReview = () => {
      expandFoldersByFeatureType(
        promptsToReview,
        reviewedPrompts,
        FeatureType.Prompt,
      );
      const firstReviewPromptId = getFirstReviewUrl(
        promptsToReview,
        reviewedPrompts,
      );
      dispatch(
        PromptsActions.uploadPrompt({
          promptId: firstReviewPromptId,
        }),
      );
      dispatch(
        PromptsActions.selectPrompt({
          promptId: firstReviewPromptId,
          isApproveRequiredResource: true,
        }),
      );
    };

    if (conversationsToReview.length) {
      startConversationsReview();
      return;
    }

    if (promptsToReview.length) {
      startPromptsReview();
      return;
    }

    if (applicationsToReview.length) {
      startApplicationsReview();
      return;
    }

    if (reviewedConversations.length) {
      startConversationsReview();
    } else if (reviewedPrompts.length) {
      startPromptsReview();
    } else {
      startApplicationsReview();
    }
  }, [dispatch, expandFoldersByFeatureType, publication, resourcesToReview]);

  const handleToggleEditMode = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('edit');
  }, []);

  const invalidEntities = useMemo(
    () =>
      notExistEntities.filter((entity) =>
        publication.resources.some(
          (resource) => resource.reviewUrl === entity.id,
        ),
      ),
    [notExistEntities, publication.resources],
  );

  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );

  return (
    <div
      className={classNames(
        'flex w-full items-center gap-5 rounded-t bg-layer-2 px-3 py-4 md:px-4',
        isOnlyFilesPublication ? 'justify-end' : 'justify-between',
      )}
    >
      {invalidEntities.length ? (
        <div className="flex items-center gap-3">
          <IconExclamationCircle
            size={24}
            className="shrink-0 text-error"
            stroke="1.5"
          />
          <p className="text-sm text-error" data-qa="duplicate-unpublishing">
            {invalidEntities.map((e, idx) => (
              <span key={e.id} className="italic">
                &quot;
                {e.name.substring(0, 50) === e.name
                  ? e.name
                  : `${e.name.substring(0, 50)}...`}
                &quot;{idx === invalidEntities.length - 1 ? ' ' : ', '}
              </span>
            ))}
            {t(
              "have already been unpublished. You can't approve this request.",
            )}
          </p>
        </div>
      ) : (
        !isOnlyFilesPublication && (
          <button
            className="text-accent-primary"
            onClick={handlePublicationReview}
            data-qa="go-to-review"
          >
            {t(
              resourcesToReview.some((r) => r.reviewed)
                ? 'Continue review'
                : 'Go to a review',
            )}
          </button>
        )
      )}
      <div className="flex items-center gap-3">
        {!isEditMode ? (
          <>
            <IconButton
              name={t('Edit')}
              dataQa="edit"
              onClick={handleToggleEditMode}
              Icon={IconPencil}
            />
            <button
              className="button button-secondary"
              onClick={() =>
                dispatch(
                  PublicationActions.rejectPublication({
                    url: publication.url,
                  }),
                )
              }
              data-qa="reject"
            >
              {t('Reject')}
            </button>
            <Tooltip
              hideTooltip={resourcesToReview.every((r) => r.reviewed)}
              tooltip={t(
                invalidEntities.length
                  ? "Request can't be approved as some conversations are unpublished"
                  : "It's required to review all resources",
              )}
            >
              <button
                className="button button-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={
                  !resourcesToReview.every((r) => r.reviewed) ||
                  !!invalidEntities.length
                }
                onClick={() =>
                  dispatch(
                    PublicationActions.approvePublication({
                      url: publication.url,
                    }),
                  )
                }
                data-qa="approve"
              >
                {t('Approve')}
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              className="button button-secondary"
              onClick={handleToggleEditMode}
              data-qa="cancel"
            >
              {t('Cancel')}
            </button>
            <Tooltip
              hideTooltip={resourcesToReview.every((r) => r.reviewed)}
              tooltip={t(
                invalidEntities.length
                  ? "Request can't be approved as some conversations are unpublished"
                  : "It's required to review all resources",
              )}
            >
              <button
                className="button button-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                onClick={handleToggleEditMode}
                data-qa="update"
              >
                {t('Update request')}
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
