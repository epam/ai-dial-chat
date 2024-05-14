import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ApiKeys, UploadStatus } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationRule,
  PublishedItem,
} from '@/src/types/publication';

import * as PublicationSelectors from './publication.selectors';

export { PublicationSelectors };

export interface PublicationState {
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublication: Publication | null;
  publishedItems: PublishedItem[];
  resourcesToReview: {
    publicationUrl: string;
    reviewed: boolean;
    reviewUrl: string;
  }[];
}

const initialState: PublicationState = {
  publications: [],
  publishedItems: [],
  selectedPublication: null,
  resourcesToReview: [],
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
      _action: PayloadAction<{ resources: { targetUrl: string }[] }>,
    ) => state,
    deletePublicationFail: (state) => state,
    uploadPublishedWithMeItems: (
      state,
      _action: PayloadAction<{ featureType: ApiKeys }>,
    ) => state,
    uploadPublishedWithMeItemsSuccess: (
      state,
      { payload }: PayloadAction<{ publishedItems: PublishedItem }>,
    ) => {
      state.publishedItems = payload.publishedItems.items || [];
    },
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
  },
});

export const PublicationActions = publicationSlice.actions;
