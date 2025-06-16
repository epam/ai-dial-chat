import { createSelector } from '@reduxjs/toolkit';

import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Publication, PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import { ShareEntity, UploadStatus } from '@epam/ai-dial-shared';

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

const selectResourcesToReviewByPublicationUrl = createSelector(
  [selectResourcesToReview, (_state, id: string) => id],
  (resourcesToReview, id) => {
    return resourcesToReview.filter((r) => r.publicationUrl === id);
  },
);

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

const selectSelectedItemsToPublish = (state: RootState) =>
  rootSelector(state).selectedItemsToPublish;

const selectChosenFolderIds = createSelector(
  [
    selectSelectedItemsToPublish,
    (_state, folders: FolderInterface[]) => folders,
    (_state, _folders: FolderInterface[], itemsShouldBeChosen: ShareEntity[]) =>
      itemsShouldBeChosen,
  ],
  (selectedItemsToPublish, folders, itemsShouldBeChosen) => {
    const fullyChosenFolderIds = folders
      .map((folder) => `${folder.id}/`)
      .filter((folderId) =>
        itemsShouldBeChosen.some((item) => item.id.startsWith(folderId)),
      )
      .filter((folderId) =>
        itemsShouldBeChosen
          .filter((item) => item.id.startsWith(folderId))
          .every((item) => selectedItemsToPublish.includes(item.id)),
      );

    const partialChosenFolderIds = folders
      .map((folder) => `${folder.id}/`)
      .filter(
        (folderId) =>
          !selectedItemsToPublish.some((chosenId) =>
            folderId.startsWith(chosenId),
          ) &&
          (selectedItemsToPublish.some((chosenId) =>
            chosenId.startsWith(folderId),
          ) ||
            selectedItemsToPublish.some((entityId) =>
              entityId.startsWith(folderId),
            )) &&
          !fullyChosenFolderIds.includes(folderId),
      );

    return { partialChosenFolderIds, fullyChosenFolderIds };
  },
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

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectPublicVersionGroups = (state: RootState) =>
  rootSelector(state).publicVersionGroups;

const selectPublicVersionGroupById = (
  state: RootState,
  versionGroupId: string,
) => (versionGroupId ? selectPublicVersionGroups(state)[versionGroupId] : null);

const selectPublishModel = (state: RootState) =>
  rootSelector(state).publishModel;

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
  selectSelectedItemsToPublish,
  selectChosenFolderIds,
  selectPublicationsToReviewCount,
  selectIsFolderContainsResourcesToReview,
  selectIsApplicationReview,
  selectInitialized,
  selectPublicVersionGroups,
  selectPublicVersionGroupById,
  selectPublishModel,
  selectIsEditMode,
  selectEntitiesEditState,
  selectFoldersEditState,
  selectEntityEditStateByReviewUrl,
  selectRulesOnEdit,
  selectIsPublicationUpdating,
  selectDisplayAuthorEditState,
};
