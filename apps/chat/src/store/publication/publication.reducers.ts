import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { sortItemsVersions } from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import {
  PublicVersionGroups,
  PublicVersionOption,
  Publication,
  PublicationInfo,
  PublicationRequestModel,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

import { PublicationState } from './publication.types';

import {
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import uniqBy from 'lodash-es/uniqBy';
import xor from 'lodash-es/xor';

const initialState: PublicationState = {
  initialized: false,
  publications: [],
  selectedPublicationUrl: null,
  resourcesToReview: [],
  rules: {},
  isRulesLoading: false,
  allPublishedWithMeItemsUploaded: {
    [FeatureType.Chat]: false,
    [FeatureType.Prompt]: false,
    [FeatureType.File]: false,
    [FeatureType.Application]: false,
  },
  selectedItemsToPublish: [],
  isApplicationReview: false,
  publicVersionGroups: {},
  publishModel: undefined,
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    publish: (state, _action: PayloadAction<PublicationRequestModel>) => state,
    publishFail: (state, _action: PayloadAction<string | undefined>) => state,
    uploadPublications: (state) => state,
    uploadPublicationsSuccess: (
      state,
      { payload }: PayloadAction<{ publications: PublicationInfo[] }>,
    ) => {
      state.publications = payload.publications;
    },
    uploadPublicationsFail: (state) => state,
    uploadPublication: (state, _action: PayloadAction<{ url: string }>) =>
      state,
    uploadPublicationSuccess: (
      state,
      { payload }: PayloadAction<{ publication: Publication }>,
    ) => {
      state.publications = state.publications.map((p) =>
        p.url === payload.publication.url
          ? { ...payload.publication, ...p, uploadStatus: UploadStatus.LOADED }
          : p,
      );
    },
    uploadPublicationFail: (state) => state,
    uploadPublishedWithMeItems: (
      state,
      _action: PayloadAction<{ featureType: FeatureType }>,
    ) => state,
    uploadAllPublishedWithMeItems: (
      state,
      _action: PayloadAction<{ featureType: FeatureType }>,
    ) => state,
    uploadAllPublishedWithMeItemsSuccess: (
      state,
      { payload }: PayloadAction<{ featureType: FeatureType }>,
    ) => {
      state.allPublishedWithMeItemsUploaded[payload.featureType] = true;
    },
    uploadAllPublishedWithMeItemsFail: (state) => state,
    uploadPublishedWithMeItemsFail: (state) => state,
    approvePublication: (state, _actions: PayloadAction<{ url: string }>) =>
      state,
    approvePublicationSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        url: string;
        triggerModelsListing: boolean;
        triggerPublicFilesListing: boolean;
      }>,
    ) => {
      state.publications = state.publications.filter(
        (p) => p.url !== payload.url,
      );
    },
    approvePublicationFail: (state) => state,
    rejectPublication: (state, _actions: PayloadAction<{ url: string }>) =>
      state,
    rejectPublicationSuccess: (
      state,
      { payload }: PayloadAction<{ url: string }>,
    ) => {
      state.publications = state.publications.filter(
        (p) => p.url !== payload.url,
      );
    },
    rejectPublicationFail: (state) => state,
    selectPublication: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedPublicationUrl = payload;
    },
    setPublicationsToReview: (
      state,
      {
        payload,
      }: PayloadAction<{
        items: ResourceToReview[];
      }>,
    ) => {
      const publicationUrls = state.resourcesToReview.map(
        (r) => r.publicationUrl,
      );
      const itemsToReview = payload.items.filter(
        (item) => !publicationUrls.includes(item.publicationUrl),
      );

      state.resourcesToReview = state.resourcesToReview.concat(itemsToReview);
    },
    markResourceAsReviewed: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
        publicationUrl: string;
      }>,
    ) => {
      state.resourcesToReview = state.resourcesToReview.map((resource) =>
        resource.reviewUrl === payload.id &&
        resource.publicationUrl === payload.publicationUrl
          ? { ...resource, reviewed: true }
          : resource,
      );
    },
    markResourcesAsReviewedByIds: (
      state,
      {
        payload,
      }: PayloadAction<{
        ids: string[];
      }>,
    ) => {
      state.resourcesToReview = state.resourcesToReview.map((resource) =>
        payload.ids.includes(resource.reviewUrl)
          ? { ...resource, reviewed: true }
          : resource,
      );
    },
    uploadRules: (state, _action: PayloadAction<{ path: string }>) => {
      state.isRulesLoading = true;
    },
    uploadRulesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ ruleRecords: Record<string, PublicationRule[]> }>,
    ) => {
      for (const key of Object.keys(payload.ruleRecords)) {
        state.rules[key] = payload.ruleRecords[key];
      }

      state.isRulesLoading = false;
    },
    uploadRulesFail: (state) => {
      state.isRulesLoading = false;
    },
    setItemsToPublish: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.selectedItemsToPublish = payload.ids;
    },
    selectItemsToPublish: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.selectedItemsToPublish = xor(
        state.selectedItemsToPublish,
        payload.ids,
      );
    },
    setIsApplicationReview: (state, { payload }: PayloadAction<boolean>) => {
      state.isApplicationReview = payload;
    },
    addPublicVersionGroups: (
      state,
      {
        payload,
      }: PayloadAction<{
        publicVersionGroups: PublicVersionGroups;
      }>,
    ) => {
      for (const key in payload.publicVersionGroups) {
        const selectedVersion =
          payload.publicVersionGroups[key]?.selectedVersion ||
          state.publicVersionGroups[key]?.selectedVersion;

        if (selectedVersion) {
          state.publicVersionGroups[key] = {
            selectedVersion,
            allVersions: sortItemsVersions(
              uniqBy(
                [
                  ...(state.publicVersionGroups[key]?.allVersions || []),
                  ...(payload.publicVersionGroups[key]?.allVersions || []),
                ],
                'id',
              ),
            ),
          };
        }
      }
    },
    setSelectedVersionForPublicVersionGroup: (
      state,
      {
        payload,
      }: PayloadAction<{
        versionGroupId: string;
        newVersion: PublicVersionOption;
      }>,
    ) => {
      // link to state.publicVersionGroups[payload.versionGroupId]
      const versionGroup = state.publicVersionGroups[payload.versionGroupId];

      if (versionGroup) {
        versionGroup.selectedVersion = payload.newVersion;
      }
    },
    resetSelectedVersionForPublicVersionGroup: (
      state,
      {
        payload,
      }: PayloadAction<{
        versionGroupId: string;
      }>,
    ) => {
      const versionGroup = state.publicVersionGroups[payload.versionGroupId];

      if (versionGroup) {
        versionGroup.selectedVersion = versionGroup.allVersions[0];
      }
    },
    removePublicVersionGroups: (
      state,
      {
        payload,
      }: PayloadAction<{
        groupsToRemove: {
          versionGroupId: string;
          groupIds: string[];
        }[];
      }>,
    ) => {
      // versionGroups it's a link to state.publicVersionGroups[payload.versionGroupId]
      const groupWithIdsToRemove = payload.groupsToRemove.map((group) => ({
        versionGroup: state.publicVersionGroups[group.versionGroupId],
        idsToRemove: group.groupIds,
        versionGroupId: group.versionGroupId,
      }));

      groupWithIdsToRemove.forEach(
        ({ versionGroup, idsToRemove, versionGroupId }) => {
          if (versionGroup) {
            const filteredVersionGroups = versionGroup.allVersions.filter(
              (group) => !idsToRemove.includes(group.id),
            );

            versionGroup.allVersions = filteredVersionGroups;

            if (idsToRemove.includes(versionGroup.selectedVersion.id)) {
              if (filteredVersionGroups[0]) {
                versionGroup.selectedVersion = filteredVersionGroups[0];
              } else {
                state.publicVersionGroups = omit(
                  state.publicVersionGroups,
                  versionGroupId,
                );
              }
            }
          }
        },
      );
    },
    setPublishModel(
      state,
      {
        payload,
      }: PayloadAction<
        | {
            entity: Omit<ShareEntity, 'folderId'> & {
              iconUrl?: string;
              folderId?: string;
            };
            action: PublishActions;
          }
        | undefined
      >,
    ) {
      if (payload) {
        state.publishModel = {
          entity: {
            name: payload.entity.name,
            id: ApiUtils.decodeApiUrl(payload.entity.id),
            folderId: getFolderIdFromEntityId(payload.entity.id),
            iconUrl: payload.entity.iconUrl,
          },
          action: payload.action,
        };
      } else {
        state.publishModel = undefined;
      }
    },
  },
});

export const PublicationActions = publicationSlice.actions;
