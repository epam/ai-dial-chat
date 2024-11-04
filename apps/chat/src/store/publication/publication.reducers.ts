import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { sortAllVersions } from '@/src/utils/app/common';

import { FeatureType } from '@/src/types/common';
import {
  PublicVersionGroups,
  Publication,
  PublicationInfo,
  PublicationRequestModel,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

import * as PublicationSelectors from './publication.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import uniqBy from 'lodash-es/uniqBy';
import xor from 'lodash-es/xor';

export { PublicationSelectors };

export interface PublicationState {
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublicationUrl: string | null;
  resourcesToReview: ResourceToReview[];
  rules: Record<string, PublicationRule[]>;
  isRulesLoading: boolean;
  allPublishedWithMeItemsUploaded: {
    [FeatureType.Chat]: boolean;
    [FeatureType.Prompt]: boolean;
    [FeatureType.File]: boolean;
    [FeatureType.Application]: boolean;
  };
  selectedItemsToPublish: string[];
  isApplicationReview: boolean;
  publicVersionGroups: PublicVersionGroups;
}

const initialState: PublicationState = {
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
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    init: (state) => state,
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
      { payload }: PayloadAction<{ url: string }>,
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
            allVersions: sortAllVersions(
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
    setNewVersionForPublicVersionGroup: (
      state,
      {
        payload,
      }: PayloadAction<{
        versionGroupId: string;
        newVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'];
      }>,
    ) => {
      // link to state.publicVersionGroups[payload.versionGroupId]
      const versionGroup = state.publicVersionGroups[payload.versionGroupId];

      if (versionGroup) {
        versionGroup.selectedVersion = payload.newVersion;
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
  },
});

export const PublicationActions = publicationSlice.actions;
