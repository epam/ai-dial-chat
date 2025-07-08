import { IconExclamationCircle, IconPencil } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import {
  isEntityNameValid,
  isVersionExists,
  isVersionPartSizeValid,
  isVersionValid,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
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

import { IconButton } from '@/src/components/Common/IconButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { Conversation, FeatureType } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

interface Props {
  publication: Publication;
  onUpdateRequest: () => void;
  isFormChanged: boolean;
}

export const PublicationHandlerFooter = ({
  publication,
  onUpdateRequest,
  isFormChanged,
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
  const itemsToApprove = useAppSelector(
    PublicationSelectors.selectSelectedItemsToApprove,
  );

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
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
        displayAuthor: replaceSpacesFromString(publication.displayAuthor),
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

  const resourcesToReviewIds = useMemo(
    () => resourcesToReview.map((resource) => resource.reviewUrl),
    [resourcesToReview],
  );

  const publicationConversationsWithUploadedMessages = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          resourcesToReviewIds.includes(conversation.id) &&
          (conversation as Conversation).messages !== undefined,
      ) as Conversation[],
    [conversations, resourcesToReviewIds],
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
    if (itemsToApprove.length !== publication.resources.length) {
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
    itemsToApprove.length,
    publication.resources.length,
    publication.url,
  ]);

  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );
  const isAllResourcesReviewed = resourcesToReview.every((r) => r.reviewed);
  const isNamesOrVersionsInvalid = Object.entries(entitiesEditState).some(
    ([key, { version, name }]) => {
      const isInvalidName = !isEntityNameValid(name);

      const isValidVersion =
        isFileId(key) ||
        (isVersionValid(version.trim()) &&
          !isVersionExists(version, key, publicVersionGroups, name) &&
          (!isApplicationId(key) || isVersionPartSizeValid(version)));

      return isInvalidName || !isValidVersion;
    },
  );
  const isFoldersInvalid = !allEditedFoldersAreValid(foldersEditState);
  const isDisplayAuthorInvalid = !isEntityNameValid(
    displayAuthorEditState,
    false,
  );

  const isEditInvalid =
    isNamesOrVersionsInvalid || isFoldersInvalid || isDisplayAuthorInvalid;
  const someReviewedConversationHaveNoMessages =
    publicationConversationsWithUploadedMessages.some(
      (conversation) => !conversation.messages.length,
    );
  const isApproveDisabled =
    !isAllResourcesReviewed ||
    !!invalidEntities.length ||
    someReviewedConversationHaveNoMessages;

  const isEditDisabled = isEditInvalid || !isFormChanged;

  return (
    <div
      className={classNames(
        'flex w-full items-center gap-3 rounded-t bg-layer-2 px-3 py-4 md:gap-5 md:px-4',
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
              hideTooltip={!isApproveDisabled}
              tooltip={t(
                invalidEntities.length
                  ? "Request can't be approved as some conversations are unpublished"
                  : someReviewedConversationHaveNoMessages
                    ? "Request can't be approved as some conversations have no messages"
                    : "It's required to review all resources",
              )}
            >
              <button
                className="button button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={isApproveDisabled}
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
                isEditInvalid
                  ? 'Request can not be updated as some resources are invalid'
                  : 'Make any changes to update the request',
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
