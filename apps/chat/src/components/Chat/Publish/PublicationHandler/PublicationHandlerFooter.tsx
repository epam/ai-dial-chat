import { IconExclamationCircle, IconPencil } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { isVersionValid, prepareEntityName } from '@/src/utils/app/common';
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
import {
  allEditedFoldersAreValid,
  getDefaultAllEditEntities,
  getFirstReviewUrl,
  getReviewItems,
} from '@/src/utils/app/publications';

import { ScreenState } from '@/src/types/common';
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

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { NA_VERSION } from '@/src/constants/publication';

import { IconButton } from '@/src/components/Common/IconButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { FeatureType } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

interface Props {
  publication: Publication;
  onUpdateRequest: () => void;
}

export const PublicationHandlerFooter = ({
  publication,
  onUpdateRequest,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const screenState = useScreenState();
  const isSmallScreen = screenState === ScreenState.SM;

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
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const entitiesEditState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );
  const foldersEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );
  const displayAuthorEditState = useAppSelector(
    PublicationSelectors.selectDisplayAuthorEditState,
  );
  const itemsToPublish = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const dispatch = useAppDispatch();

  useEffect(() => {
    // reset edit mode state when publication changes
    dispatch(PublicationActions.setIsEditMode(false));
  }, [dispatch, publication.url]);

  useEffect(() => {
    dispatch(
      PublicationActions.setEditModeState({
        editState: getDefaultAllEditEntities(publication.resources),
        rules: publication.rules ?? [],
        displayAuthor: publication.displayAuthor ?? '',
      }),
    );
  }, [
    dispatch,
    publication.resources,
    isEditMode,
    publication.rules,
    publication.displayAuthor,
    publication.author,
  ]);

  const notExistEntities = useMemo(
    () =>
      [...files, ...conversations, ...prompts, ...applications].filter(
        (entity) => entity.publicationInfo?.isNotExist,
      ),
    [conversations, files, prompts, applications],
  );

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
    dispatch(PublicationActions.setIsEditMode(!isEditMode));
  }, [dispatch, isEditMode]);

  const invalidEntities = useMemo(
    () =>
      notExistEntities.filter((entity) =>
        publication.resources.some(
          (resource) => resource.reviewUrl === entity.id,
        ),
      ),
    [notExistEntities, publication.resources],
  );

  const handleApprovePublication = useCallback(() => {
    if (itemsToPublish.length !== publication.resources.length) {
      dispatch(PublicationActions.updateAndApprovePublicationRequest());
    } else {
      dispatch(
        PublicationActions.approvePublication({
          url: publication.url,
        }),
      );
    }
  }, [
    dispatch,
    itemsToPublish.length,
    publication.resources.length,
    publication.url,
  ]);

  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );
  const isAllResourcesReviewed = resourcesToReview.every((r) => r.reviewed);
  const isNamesOrVersionsInvalid = Object.values(entitiesEditState).some(
    ({ version, name }) => {
      return (
        !prepareEntityName(name) ||
        (!isVersionValid(version) && version !== NA_VERSION)
      );
    },
  );
  const isFoldersInvalid = !allEditedFoldersAreValid(foldersEditState);
  const isDisplayAuthorInvalid =
    !displayAuthorEditState.trim().length ||
    displayAuthorEditState.length > MAX_ENTITY_LENGTH;
  const isEditDisabled =
    isNamesOrVersionsInvalid || isFoldersInvalid || isDisplayAuthorInvalid;

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
            {!invalidEntities.length && (
              <IconButton
                name={t('Edit')}
                dataQa="edit"
                onClick={handleToggleEditMode}
                Icon={IconPencil}
              />
            )}
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
              hideTooltip={isAllResourcesReviewed}
              tooltip={t(
                invalidEntities.length
                  ? "Request can't be approved as some conversations are unpublished"
                  : "It's required to review all resources",
              )}
            >
              <button
                className="button button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={!isAllResourcesReviewed || !!invalidEntities.length}
                onClick={handleApprovePublication}
                data-qa="approve"
              >
                {isSmallScreen ? t('Approve') : t('Approve selected')}
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
              hideTooltip={!isEditDisabled}
              tooltip={t(
                'Request can not be updated as some resources are invalid',
              )}
            >
              <button
                className="button button-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                onClick={onUpdateRequest}
                disabled={isEditDisabled}
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
};
