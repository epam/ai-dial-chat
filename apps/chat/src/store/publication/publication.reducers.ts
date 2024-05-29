import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FeatureType, UploadStatus } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

import * as PublicationSelectors from './publication.selectors';

export { PublicationSelectors };

export interface PublicationState {
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublication: Publication | null;
  resourcesToReview: ResourceToReview[];
  rules: Record<string, PublicationRule[]>;
  isRulesLoading: boolean;
}

const initialState: PublicationState = {
  publications: [],
  selectedPublication: null,
  resourcesToReview: [],
  rules: {},
  isRulesLoading: false,
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    init: (state) => state,
    publish: (
      state,
      _action: PayloadAction<{
        resources: { sourceUrl: string; targetUrl: string }[];
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
    deletePublication: (
      state,
      _action: PayloadAction<{
        targetFolder: string;
        resources: { targetUrl: string }[];
      }>,
    ) => state,
    deletePublicationFail: (state) => state,
    uploadPublishedWithMeItems: (
      state,
      _action: PayloadAction<{ featureType: FeatureType }>,
    ) => state,
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
    selectPublication: (
      state,
      { payload }: PayloadAction<{ publication: Publication }>,
    ) => {
      state.selectedPublication = payload.publication;
    },
    setPublicationsToReview: (
      state,
      {
        payload,
      }: PayloadAction<{
        items: {
          publicationUrl: string;
          reviewed: boolean;
          reviewUrl: string;
        }[];
      }>,
    ) => {
      const reviewUrls = state.resourcesToReview.map((r) => r.reviewUrl);
      const itemsToReview = payload.items.filter(
        (item) => !reviewUrls.includes(item.reviewUrl),
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
  },
});

export const PublicationActions = publicationSlice.actions;
