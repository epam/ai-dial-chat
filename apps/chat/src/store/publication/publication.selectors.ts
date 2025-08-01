import { createSelector } from '@reduxjs/toolkit';

import { getPartialAndFullyChosenFolders } from '@/src/utils/app/folders';
import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { getEntityBucket } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Publication, PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import {
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.publication;

const selectPublications = (state: RootState) =>
  rootSelector(state).publications;

const selectFilteredPublications = (
  featureTypes: FeatureType[],
  includeEmptyResourceTypes?: boolean,
) =>
  createSelector([selectPublications], (publications) => {
    return publications.filter(
      (publication) =>
        publication.resourceTypes.some((resourceType) =>
          featureTypes
            .map((featureType) =>
              EnumMapper.getBackendResourceTypeByFeatureType(featureType),
            )
            .includes(resourceType),
        ) ||
        (includeEmptyResourceTypes && !publication.resourceTypes.length),
    );
  });

const selectFilteredPublicationResources = (featureTypes: FeatureType[]) =>
  createSelector(
    [selectFilteredPublications(featureTypes)],
    (filteredPublications) => {
      return filteredPublications
        .filter((publication) => publication.resources)
        .flatMap(
          (publication) => publication.resources,
        ) as PublicationResource[];
    },
  );

const selectSelectedPublicationUrl = (state: RootState) =>
  rootSelector(state).selectedPublicationUrl;

const selectSelectedPublication = createSelector(
  [selectSelectedPublicationUrl, selectPublications],
  (selectedPublicationUrl, publications) => {
    return selectedPublicationUrl
      ? (publications.find(
          (publication) => publication.url === selectedPublicationUrl,
        ) as Publication)
      : null;
  },
);

const selectSelectedPublicationReviewBucket = createSelector(
  [selectSelectedPublication],
  (selectedPublication) => {
    const firstResource = selectedPublication?.resources.at(0)?.reviewUrl;
    return firstResource ? getEntityBucket({ id: firstResource }) : undefined;
  },
);

const selectPublicationByUrl = createSelector(
  [selectPublications, (_state, url: string) => url],
  (publications, url) => {
    return publications.find((publication) => publication.url === url);
  },
);

const selectResourcesToReview = (state: RootState) =>
  rootSelector(state).resourcesToReview;

const selectResourceToReviewByReviewUrl = createSelector(
  [
    selectResourcesToReview,
    selectSelectedPublication,
    (_state, id: string) => id,
  ],
  (resourcesToReview, selectedPublication, id) => {
    return resourcesToReview.find(
      (resource) =>
        resource.reviewUrl === id &&
        selectedPublication?.url === resource.publicationUrl,
    );
  },
);

const selectResourceToReviewByReviewAndPublicationUrls = createSelector(
  [
    selectResourcesToReview,
    (_state, id: string) => id,
    (_state, _id: string, publicationUrl?: string) => publicationUrl,
  ],
  (resourcesToReview, id, publicationUrl) => {
    return resourcesToReview.find(
      (resource) =>
        resource.reviewUrl === id && publicationUrl === resource.publicationUrl,
    );
  },
);

const selectSelectedItemsToPublish = (state: RootState) =>
  rootSelector(state).selectedItemsToPublish;

const _selectRules = (state: RootState) => rootSelector(state).rules;

const selectRulesByPath = createSelector(
  [_selectRules, (_state, path: string) => path],
  (rules, path) => {
    return Object.fromEntries(
      Object.entries(rules).filter(
        ([key]) => path.startsWith(key) && key.split('/').length !== 1,
      ),
    );
  },
);

const selectIsRulesLoading = (state: RootState) =>
  rootSelector(state).isRulesLoading;

const selectIsAllItemsUploaded = (state: RootState, featureType: FeatureType) =>
  rootSelector(state).allPublishedWithMeItemsUploaded[featureType];

const selectAllSelectedItemsToApprove = (state: RootState) =>
  rootSelector(state).selectedItemsToApprove;

const selectSelectedItemsToApprove = createSelector(
  [selectAllSelectedItemsToApprove, selectSelectedPublicationUrl],
  (selectedItemsToApprove, selectedPublicationUrl) => {
    if (!selectedPublicationUrl) {
      return [];
    }

    return selectedItemsToApprove[selectedPublicationUrl] ?? [];
  },
);

const selectResourcesToReviewByPublicationUrl = createSelector(
  [
    selectResourcesToReview,
    selectSelectedItemsToApprove,
    (_state, id: string) => id,
  ],
  (resourcesToReview, selectedItemsToApprove, id) => {
    const itemsToPublish = new Set(selectedItemsToApprove);
    return resourcesToReview.filter(
      (r) =>
        r.publicationUrl === id &&
        (itemsToPublish.has(r.reviewUrl) || itemsToPublish.has(r.sourceUrl)),
    );
  },
);

const _selectChosenFolderIds = createSelector(
  [
    selectSelectedItemsToPublish,
    (_state, folders: FolderInterface[]) => folders,
    (_state, _folders: FolderInterface[], itemsShouldBeChosen: ShareEntity[]) =>
      itemsShouldBeChosen,
  ],
  (selectedItems, folders, itemsShouldBeChosen) => {
    return getPartialAndFullyChosenFolders(
      folders,
      itemsShouldBeChosen,
      selectedItems,
    );
  },
);

const _selectChosenFolderIdsToApprove = createSelector(
  [
    selectSelectedItemsToApprove,
    (_state, folders: FolderInterface[]) => folders,
    (_state, _folders: FolderInterface[], itemsShouldBeChosen: ShareEntity[]) =>
      itemsShouldBeChosen,
  ],
  (selectedItems, folders, itemsShouldBeChosen) => {
    return getPartialAndFullyChosenFolders(
      folders,
      itemsShouldBeChosen,
      selectedItems,
    );
  },
);

const selectChosenFolderIds =
  (folders: FolderInterface[], items: ShareEntity[]) => (state: RootState) =>
    _selectChosenFolderIds(state, folders, items);

const selectChosenFolderIdsToApprove =
  (folders: FolderInterface[], items: ShareEntity[]) => (state: RootState) =>
    _selectChosenFolderIdsToApprove(state, folders, items);

const selectPublicationsToReviewCount = createSelector(
  [
    selectPublications,
    selectResourcesToReview,
    (_state, featureTypes: FeatureType[]) => featureTypes,
    (
      _state,
      _featureTypes: FeatureType[],
      includeEmptyFeatureTypes?: boolean,
    ) => includeEmptyFeatureTypes,
  ],
  (publications, resourcesToReview, featureTypes, includeEmptyFeatureTypes) => {
    const filteredPublications = publications.filter(
      (p) =>
        featureTypes.some((featureType) =>
          p.resourceTypes.includes(
            EnumMapper.getBackendResourceTypeByFeatureType(featureType),
          ),
        ) ||
        (includeEmptyFeatureTypes && !p.resourceTypes.length),
    );

    return filteredPublications.filter(
      (p) =>
        !resourcesToReview
          .filter((r) => r.publicationUrl === p.url)
          .filter((item) => !isFileId(item.reviewUrl))
          .every((r) => r.reviewed) || p.uploadStatus !== UploadStatus.LOADED,
    ).length;
  },
);

const selectIsFolderContainsResourcesToReview = createSelector(
  [
    selectResourcesToReview,
    (_state, folderId: string) => folderId,
    (_state, _folderId: string, publicationUrl?: string) => publicationUrl,
  ],
  (resourcesToReview, folderId, publicationUrl) => {
    return resourcesToReview.some(
      (r) =>
        r.reviewUrl.startsWith(`${folderId}/`) &&
        !r.reviewed &&
        r.publicationUrl === publicationUrl,
    );
  },
);

const selectIsApplicationReview = (state: RootState) =>
  rootSelector(state).isApplicationReview;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectPublicVersionGroups = (state: RootState) =>
  rootSelector(state).publicVersionGroups;

const selectPublicVersionGroupById = (
  state: RootState,
  versionGroupId: string,
) => (versionGroupId ? selectPublicVersionGroups(state)[versionGroupId] : null);

const selectPublishModel = (state: RootState) =>
  rootSelector(state).publishModel;

const selectIsApproveRequiredEntity = createSelector(
  [selectResourcesToReview, (_state, id: string) => id],
  (resourcesToReview, id) => {
    return resourcesToReview.some((r) => r.reviewUrl === id);
  },
);

const selectIsApproveRequiredEntitySelected = createSelector(
  [
    selectSelectedPublication,
    (state, id: string) => selectResourceToReviewByReviewUrl(state, id),
  ],
  (selectedPublication, resourceToReview) => {
    if (!resourceToReview || !selectedPublication) {
      return false;
    }

    return selectedPublication.resources.some(
      (resource) => resource.reviewUrl === resourceToReview.reviewUrl,
    );
  },
);
const selectIsEditMode = (state: RootState) => rootSelector(state).isEditMode;

const selectEntitiesEditState = (state: RootState) =>
  rootSelector(state).entitiesEditState;

const selectFoldersEditState = (state: RootState) =>
  rootSelector(state).foldersEditState;

const selectEntityEditStateByReviewUrl = createSelector(
  [selectEntitiesEditState, (_state, reviewUrl: string) => reviewUrl],
  (entitiesEditState, reviewUrl): { name: string; version: string } | null => {
    return entitiesEditState[reviewUrl] ?? null;
  },
);

const selectRulesOnEdit = (state: RootState) => rootSelector(state).rulesOnEdit;

const selectIsPublicationUpdating = (state: RootState) =>
  rootSelector(state).isPublicationUpdating;

const selectDisplayAuthorEditState = (state: RootState) =>
  rootSelector(state).displayAuthorEditState;

const selectPublishToUrl = (state: RootState) =>
  rootSelector(state).publishToUrl;

const selectIsResourceUnpublishing = createSelector(
  [
    (state: RootState, publicationUrl: string) =>
      selectPublicationByUrl(state, publicationUrl),
    (_state, _publicationUrl: string, reviewUrl: string) => reviewUrl,
  ],
  (publication, reviewUrl) => {
    const action = publication?.resources?.find(
      (res) => res.reviewUrl === reviewUrl,
    )?.action;

    return action === PublishActions.DELETE;
  },
);

export const PublicationSelectors = {
  selectPublications,
  selectFilteredPublications,
  selectFilteredPublicationResources,
  selectSelectedPublicationUrl,
  selectSelectedPublication,
  selectSelectedPublicationReviewBucket,
  selectPublicationByUrl,
  selectResourcesToReview,
  selectResourceToReviewByReviewUrl,
  selectResourceToReviewByReviewAndPublicationUrls,
  selectResourcesToReviewByPublicationUrl,
  selectRulesByPath,
  selectIsRulesLoading,
  selectIsAllItemsUploaded,
  selectSelectedItemsToPublish,
  selectAllSelectedItemsToApprove,
  selectSelectedItemsToApprove,
  selectChosenFolderIds,
  selectChosenFolderIdsToApprove,
  selectPublicationsToReviewCount,
  selectIsFolderContainsResourcesToReview,
  selectIsApplicationReview,
  selectInitialized,
  selectPublicVersionGroups,
  selectPublicVersionGroupById,
  selectPublishModel,
  selectIsApproveRequiredEntity,
  selectIsApproveRequiredEntitySelected,
  selectIsEditMode,
  selectEntitiesEditState,
  selectFoldersEditState,
  selectEntityEditStateByReviewUrl,
  selectRulesOnEdit,
  selectIsPublicationUpdating,
  selectDisplayAuthorEditState,
  selectPublishToUrl,
  selectIsResourceUnpublishing,
};
