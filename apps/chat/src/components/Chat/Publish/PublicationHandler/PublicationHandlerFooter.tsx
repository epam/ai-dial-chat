import { IconExclamationCircle, IconPencil } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

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
  isToolsetId,
} from '@/src/utils/app/id';
import {
  allEditedFoldersAreValid,
  getFirstReviewUrl,
  getReviewItems,
  orderByType,
} from '@/src/utils/app/publications';

import { ScreenState } from '@/src/types/common';
import {
  Publication,
  PublicationHandlerState,
  ResourceToReview,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ConversationsActions,
  PromptsActions,
  PublicationActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import {
  AuthSelectors,
  ConversationsSelectors,
  PromptsSelectors,
  PublicationSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';
import { NA_VERSION, PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import {
  PublicationRequestFormData,
  PublishRequestFieldsNames,
} from '@/src/components/Chat/Publish/form';
import { translatePublicationChatLabel } from '@/src/components/Chat/Publish/translatePublicationName';
import { IconButton } from '@/src/components/Common/IconButton';

import {
  Conversation,
  FeatureType,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';
import {
  DialLinkButton,
  DialNeutralButton,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

const formErrors = {
  [PublishRequestFieldsNames.PUBLISH_REQUEST_NAME]:
    'Enter a valid name for the publish request',
  [PublishRequestFieldsNames.PUBLICATION_AUTHOR]: 'Enter an author name',
};

interface Props {
  initialState: PublicationHandlerState;
  publication: Publication;
  isFormChanged: boolean;
  areRulesChanged: boolean;
  isDraftRuleFilterOpen: boolean;
  isReview: boolean;
}

export const PublicationHandlerFooter = ({
  initialState,
  publication,
  isFormChanged,
  areRulesChanged,
  isDraftRuleFilterOpen,
  isReview,
}: Props) => {
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const screenState = useScreenState();
  const isSmallScreen = screenState === ScreenState.SM;

  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel);
  const userName = useAppSelector(AuthSelectors.selectUserName);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const applications = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );
  const toolsets = useAppSelector(
    ToolsetSelectors.selectPublishRequestToolsets,
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
  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publication.url),
  );
  const selectedCredentialsItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedCredentialsItems(state, publication.url),
  );
  const isPublicationUpdating = useAppSelector(
    PublicationSelectors.selectIsPublicationUpdating,
  );
  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const { control } = useFormContext<PublicationRequestFormData>();
  const { errors, isValid } = useFormState({ control });

  const formError =
    formErrors[
      Object.keys(errors)[0] as
        | PublishRequestFieldsNames.PUBLICATION_AUTHOR
        | PublishRequestFieldsNames.PUBLISH_REQUEST_NAME
    ];

  const dispatch = useAppDispatch();

  useEffect(() => {
    // reset edit mode state when publication changes
    dispatch(PublicationActions.setIsEditMode(false));
  }, [dispatch, publication.url]);

  useEffect(() => {
    dispatch(
      PublicationActions.setEditModeState({
        editState: initialState,
        rules: publication.rules ?? [],
        displayAuthor: isEditMode
          ? replaceSpacesFromString(publication.displayAuthor)
          : userName,
        publishToUrl: publication.targetFolder,
      }),
    );
  }, [
    dispatch,
    publication.resources,
    isEditMode,
    publication.rules,
    publication.displayAuthor,
    publication.author,
    publication.targetFolder,
    userName,
    publicVersionGroups,
    initialState,
  ]);

  const notExistEntities: ShareEntity[] = useMemo(
    () =>
      [
        ...files,
        ...conversations,
        ...prompts,
        ...applications,
        ...toolsets,
      ].filter((entity) => entity.publicationInfo?.isNotExist),
    [conversations, files, prompts, applications, toolsets],
  );

  const resourcesToReviewIds = useMemo(
    () => resourcesToReview.map((resource) => resource.reviewUrl),
    [resourcesToReview],
  );

  const uploadedPublicationConversations = useMemo(
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
      if (isReview) return;

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
    [dispatch, isReview],
  );

  const handlePublicationReview = useCallback(() => {
    const { toReview: conversationsToReview, reviewed: reviewedConversations } =
      getReviewItems(publication, resourcesToReview, isConversationId);
    const { toReview: promptsToReview, reviewed: reviewedPrompts } =
      getReviewItems(publication, resourcesToReview, isPromptId);
    const { toReview: applicationsToReview, reviewed: reviewedApplications } =
      getReviewItems(publication, resourcesToReview, isApplicationId);
    const { toReview: toolsetsToReview, reviewed: reviewedToolsets } =
      getReviewItems(publication, resourcesToReview, isToolsetId);

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

    const startToolsetReview = () => {
      const toolsetId = getFirstReviewUrl(toolsetsToReview, reviewedToolsets);
      dispatch(
        ToolsetActions.getToolsetDetails({
          id: toolsetId,
        }),
      );
      dispatch(PublicationActions.setIsToolsetReview(true));
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

    if (toolsetsToReview.length) {
      startToolsetReview();
      return;
    }

    if (reviewedConversations.length) {
      startConversationsReview();
    } else if (reviewedPrompts.length) {
      startPromptsReview();
    } else if (reviewedApplications.length) {
      startApplicationsReview();
    } else if (reviewedToolsets.length) {
      startToolsetReview();
    }
  }, [dispatch, expandFoldersByFeatureType, publication, resourcesToReview]);

  const handleToggleEditMode = useCallback(() => {
    dispatch(PublicationActions.setIsEditMode(!isEditMode));
  }, [dispatch, isEditMode]);

  const invalidEntities: ShareEntity[] = useMemo(
    () =>
      notExistEntities.filter((entity) =>
        publication.resources.some(
          (resource) => resource.reviewUrl === entity.id,
        ),
      ),
    [notExistEntities, publication.resources],
  );

  useEffect(() => {
    dispatch(
      PublicationActions.setCurrentPublicationInvalidEntities(
        invalidEntities.map((entity) => entity.id),
      ),
    );
  }, [dispatch, invalidEntities]);

  const handleApprovePublication = () => {
    const itemsWithCredentials = publication.resources.filter(
      (resource) => resource.publishCredentials,
    );

    if (
      selectedPublicationItems.length !== publication.resources.length ||
      selectedCredentialsItems.length !== itemsWithCredentials.length
    ) {
      dispatch(PublicationActions.updateAndApprovePublicationRequest());
    } else {
      dispatch(
        PublicationActions.approvePublication({
          url: publication.url,
        }),
      );
    }
  };

  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );
  const isAllResourcesReviewed = resourcesToReview.every((r) => r.reviewed);
  const getPublicKey = (reviewUrl: string) => {
    const parts = reviewUrl.split('/');
    parts[1] = PUBLIC_URL_PREFIX;
    return parts.join('/');
  };

  const hasDuplicateVersion = Object.entries(entitiesEditState).some(
    ([key, { version, name }]) =>
      isVersionExists(version, getPublicKey(key), publicVersionGroups, name),
  );

  const isNamesOrVersionsInvalid =
    hasDuplicateVersion ||
    Object.entries(entitiesEditState).some(([key, { version, name }]) => {
      const isInvalidName = !isEntityNameValid(name);

      const resource = publication.resources.find(
        ({ reviewUrl }) => reviewUrl === key,
      );

      const isValidVersion =
        resource?.action === PublishActions.DELETE ||
        publishModel?.action === PublishActions.DELETE ||
        isFileId(key) ||
        (isVersionValid(version.trim()) &&
          !isVersionExists(
            version,
            getPublicKey(key),
            publicVersionGroups,
            name,
          ) &&
          (!isApplicationId(key) || isVersionPartSizeValid(version)));

      return isInvalidName || !isValidVersion;
    });
  const isFoldersInvalid = !allEditedFoldersAreValid(foldersEditState);

  const isEditInvalid =
    isNamesOrVersionsInvalid || isFoldersInvalid || !isValid;
  const someReviewedConversationHasNoMessages =
    uploadedPublicationConversations.some((conversation) => {
      const isEmpty =
        !conversation.messages.length &&
        !conversation.playback?.messagesStack.length;

      if (!isEmpty) {
        return false;
      }

      const resource = publication.resources.find(
        (res) => res.reviewUrl === conversation.id,
      );

      return resource?.action !== PublishActions.DELETE;
    });
  const areNoChanges =
    !selectedPublicationItems.length &&
    (publication.targetFolder === `${PUBLIC_URL_PREFIX}/` || !areRulesChanged);
  const selectedInvalidEntities = useMemo(
    () =>
      sortBy(
        invalidEntities.filter((e) => selectedPublicationItems.includes(e.id)),
        [(e) => orderByType(e.id), (e) => e.id.toLowerCase()],
      ),
    [invalidEntities, selectedPublicationItems],
  );

  const isApproveDisabled =
    !isAllResourcesReviewed ||
    !!selectedInvalidEntities.length ||
    someReviewedConversationHasNoMessages ||
    isPublicationUpdating ||
    areNoChanges;

  const isEditDisabled = isEditInvalid || !isFormChanged;

  const getSubmitTooltipText = useCallback(() => {
    if (publishModel) {
      if (isDraftRuleFilterOpen) {
        return ChatI18nKeys.AcceptOrRejectRulesChanges;
      }
      if (!isValid) {
        return formError;
      }
      if (areNoChanges) {
        return ChatI18nKeys.NothingIsSelectedAndRulesHaveNotChanged;
      }
      if (hasDuplicateVersion) {
        return ChatI18nKeys.DuplicateVersionFound;
      }

      return ChatI18nKeys.RequestCantBePublishedAsSomeItemsAreInvalid;
    }

    return selectedInvalidEntities.length
      ? ChatI18nKeys.RequestCantBeApprovedAsSomeItemsAreUnpublished
      : someReviewedConversationHasNoMessages
        ? ChatI18nKeys.RequestCantBeApprovedAsSomeConversationsHaveNoMessages
        : isPublicationUpdating
          ? ChatI18nKeys.RequestIsUpdating
          : areNoChanges
            ? ChatI18nKeys.ThereAreNoChangesToApprove
            : ChatI18nKeys.ItsRequiredToReviewAllResources;
  }, [
    publishModel,
    selectedInvalidEntities.length,
    someReviewedConversationHasNoMessages,
    isPublicationUpdating,
    areNoChanges,
    isValid,
    formError,
    isDraftRuleFilterOpen,
    hasDuplicateVersion,
  ]);

  const isApproveOrSendDisabled =
    (isApproveDisabled && !publishModel) ||
    (publishModel &&
      (isEditInvalid || !isValid || areNoChanges || isDraftRuleFilterOpen));

  const submitButtonKey = useMemo(() => {
    if (publishModel) {
      return ChatI18nKeys.SendRequest;
    }

    return !publication.resources.length || isSmallScreen
      ? ChatI18nKeys.Approve
      : ChatI18nKeys.ApproveSelected;
  }, [publishModel, publication.resources.length, isSmallScreen]);

  const submitButtonLabel = useMemo(
    () => translatePublicationChatLabel(submitButtonKey, router.locale, t),
    [router.locale, submitButtonKey, t],
  );

  return (
    <div
      className={classNames(
        'flex w-full items-center gap-3 rounded-t bg-layer-2 px-3 py-4 md:gap-5 md:px-4',
        isOnlyFilesPublication || !resourcesToReview.length
          ? 'justify-end'
          : 'justify-between',
      )}
    >
      {selectedInvalidEntities.length ? (
        <div className="flex items-center gap-3">
          <IconExclamationCircle
            size={DEFAULT_ICON_SIZES.STANDARD}
            className="shrink-0 text-error"
            stroke="1.5"
          />
          <p className="text-sm text-error" data-qa="duplicate-unpublishing">
            {selectedInvalidEntities.map((entity, idx) => (
              <span key={entity.id} className="italic">
                &quot;
                {entity.name.substring(0, 50) === entity.name
                  ? entity.name
                  : `${entity.name.substring(0, 50)}...`}{' '}
                {t(ChatI18nKeys.VersionAbbr)}.{' '}
                {entity.publicationInfo?.version ?? NA_VERSION}
                &quot;{idx === selectedInvalidEntities.length - 1 ? ' ' : ', '}
              </span>
            ))}
            {t(
              selectedInvalidEntities.length > 1
                ? ChatI18nKeys.EntitiesHaveAlreadyBeenUnpublishedCantApproveRequest
                : ChatI18nKeys.EntityHasAlreadyBeenUnpublishedCantApproveRequest,
            )}
          </p>
        </div>
      ) : (
        !isOnlyFilesPublication &&
        !!resourcesToReview.length && (
          <DialLinkButton
            className="px-0"
            onClick={handlePublicationReview}
            disabled={isPublicationUpdating}
            data-qa="go-to-review"
            label={t(
              resourcesToReview.some((r) => r.reviewed)
                ? ChatI18nKeys.ContinueReviewPublication
                : ChatI18nKeys.GoToAReview,
            )}
          />
        )
      )}
      <div className="flex items-center gap-3">
        {!isEditMode ? (
          <>
            {!publishModel && (
              <>
                {!selectedInvalidEntities.length && (
                  <IconButton
                    name={t(ChatI18nKeys.Edit)}
                    dataQa="edit"
                    onClick={handleToggleEditMode}
                    Icon={IconPencil}
                    disabled={isPublicationUpdating}
                  />
                )}
                <DialNeutralButton
                  label={t(ChatI18nKeys.Reject)}
                  onClick={() =>
                    dispatch(
                      PublicationActions.rejectPublication({
                        url: publication.url,
                      }),
                    )
                  }
                  data-qa="reject"
                  disabled={isPublicationUpdating}
                />
              </>
            )}
            <DialPrimaryButton
              tooltipProps={{
                hideTooltip: !isApproveOrSendDisabled,
                tooltip: t(getSubmitTooltipText()),
              }}
              label={submitButtonLabel}
              textClassName="whitespace-nowrap"
              onClick={publishModel ? undefined : handleApprovePublication}
              type={publishModel ? 'submit' : 'button'}
              disabled={isApproveOrSendDisabled}
              data-qa="submit"
            />
          </>
        ) : (
          <>
            <DialNeutralButton
              label={t(ChatI18nKeys.Cancel)}
              onClick={handleToggleEditMode}
              data-qa="cancel"
            />

            <DialPrimaryButton
              label={t(ChatI18nKeys.UpdateRequest)}
              textClassName="whitespace-nowrap"
              disabled={isEditDisabled}
              type="submit"
              data-qa="update"
              tooltipProps={{
                hideTooltip: !isEditDisabled,
                tooltip: t(
                  isEditInvalid
                    ? ChatI18nKeys.RequestCannotBeUpdated
                    : ChatI18nKeys.MakeChangesToUpdate,
                ),
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};
