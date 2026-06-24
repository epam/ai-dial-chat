import { createSelector } from '@reduxjs/toolkit';

import { getPartialAndFullyChosenFolders } from '@/src/utils/app/folders';
import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { orderByType } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { Publication, PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import {
  FolderInterface,
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';

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

const _selectRules = (state: RootState) => rootSelector(state).rules;

const selectRulesByPath = createSelector(
  [_selectRules, (_state, path: string) => path],
  (rules, path) => {
    return Object.fromEntries(
      Object.entries(rules).filter(
        ([key]) => path === key || path.startsWith(`${key}/`),
      ),
    );
  },
);

const selectIsRulesLoading = (state: RootState) =>
  rootSelector(state).isRulesLoading;

const selectIsAllItemsUploaded = (state: RootState, featureType: FeatureType) =>
  rootSelector(state).allPublishedWithMeItemsUploaded[featureType];

const selectAllSelectedPublicationItems = (state: RootState) =>
  rootSelector(state).selectedPublicationItems;

const selectSelectedPublicationItems = createSelector(
  [
    selectAllSelectedPublicationItems,
    (_state, publicationUrl: string) => publicationUrl,
  ],
  (selectedPublicationItems, publicationUrl) => {
    return selectedPublicationItems[publicationUrl] ?? [];
  },
);

const selectAllSelectedCredentialsItems = (state: RootState) =>
  rootSelector(state).selectedCredentialsItems;

const selectSelectedCredentialsItems = createSelector(
  [
    selectAllSelectedCredentialsItems,
    (_state, publicationUrl: string) => publicationUrl,
  ],
  (selectedCredentialsItems, publicationUrl) => {
    return selectedCredentialsItems[publicationUrl] ?? [];
  },
);

const selectResourcesToReviewByPublicationUrl = createSelector(
  [
    selectResourcesToReview,
    selectSelectedPublicationItems,
    (_state, id: string) => id,
  ],
  (resourcesToReview, selectedItems, id) => {
    const itemsToPublish = new Set(selectedItems);
    const resources = resourcesToReview.filter(
      (r) =>
        r.publicationUrl === id &&
        (itemsToPublish.has(r.reviewUrl) || itemsToPublish.has(r.sourceUrl)),
    );
    return sortBy(resources, [
      (r) => orderByType(r.reviewUrl),
      (r) => (r.sourceUrl ?? r.reviewUrl).toLowerCase(),
    ]);
  },
);

const _selectChosenPublicationFolderIds = createSelector(
  [
    selectSelectedPublicationItems,
    (_state, _publicationUrl: string, folders: FolderInterface[]) => folders,
    (
      _state,
      _publicationUrl: string,
      _folders: FolderInterface[],
      itemsShouldBeChosen: ShareEntity[],
    ) => itemsShouldBeChosen,
    (
      _state,
      _publicationUrl: string,
      _folders: FolderInterface[],
      _itemsShouldBeChosen: ShareEntity[],
      directContainerFolderIds: string[],
    ) => directContainerFolderIds,
  ],
  (selectedItems, folders, itemsShouldBeChosen, directContainerFolderIds) => {
    return getPartialAndFullyChosenFolders(
      folders,
      itemsShouldBeChosen,
      selectedItems,
      undefined,
      undefined,
      directContainerFolderIds,
    );
  },
);

const selectChosenPublicationFolderIds =
  (
    publicationUrl: string,
    folders: FolderInterface[],
    items: ShareEntity[],
    directContainerFolderIds: string[],
  ) =>
  (state: RootState) =>
    _selectChosenPublicationFolderIds(
      state,
      publicationUrl,
      folders,
      items,
      directContainerFolderIds,
    );

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

const selectIsToolsetReview = (state: RootState) =>
  rootSelector(state).isToolsetReview;

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

const selectIsPublicationUpdating = (state: RootState) =>
  rootSelector(state).isPublicationUpdating;

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

const selectCurrentPublicationInvalidEntities = (state: RootState) =>
  rootSelector(state).currentPublicationInvalidEntities;

export const PublicationSelectors = {
  selectPublications,
  selectFilteredPublications,
  selectFilteredPublicationResources,
  selectSelectedPublicationUrl,
  selectSelectedPublication,
  selectPublicationByUrl,
  selectResourcesToReview,
  selectResourceToReviewByReviewUrl,
  selectResourceToReviewByReviewAndPublicationUrls,
  selectResourcesToReviewByPublicationUrl,
  selectRulesByPath,
  selectIsRulesLoading,
  selectIsAllItemsUploaded,
  selectAllSelectedPublicationItems,
  selectSelectedPublicationItems,
  selectSelectedCredentialsItems,
  selectChosenPublicationFolderIds,
  selectPublicationsToReviewCount,
  selectIsFolderContainsResourcesToReview,
  selectIsApplicationReview,
  selectIsToolsetReview,
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
  selectIsPublicationUpdating,
  selectIsResourceUnpublishing,
  selectCurrentPublicationInvalidEntities,
};
