import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import {
  Publication,
  PublicationInfo,
  PublicationRule,
  PublishActions,
  ResourceToReview,
} from '@/src/types/publication';

import * as PublicationSelectors from './publication.selectors';

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
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    init: (state) => state,
    publish: (
      state,
      _action: PayloadAction<{
        name: string;
        action: PublishActions;
        resources: { sourceUrl?: string; targetUrl: string }[];
        targetFolder: string;
        rules: PublicationRule[];
      }>,
    ) => state,
    publishFail: (state) => state,
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
      }>,
    ) => {
      state.resourcesToReview = state.resourcesToReview.map((r) =>
        r.reviewUrl === payload.id ? { ...r, reviewed: true } : r,
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
    selectItemsToPublish: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.selectedItemsToPublish = xor(
        state.selectedItemsToPublish,
        payload.ids,
      );
    },
    resetItemsToPublish: (state) => {
      state.selectedItemsToPublish = [];
    },
    setIsApplicationReview: (state, { payload }: PayloadAction<boolean>) => {
      state.isApplicationReview = payload;
    },
  },
});

export const PublicationActions = publicationSlice.actions;
