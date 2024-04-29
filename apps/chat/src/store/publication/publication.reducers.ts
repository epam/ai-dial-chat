import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ApiKeys, BackendResourceType, UploadStatus } from '@/src/types/common';
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
}

const initialState: PublicationState = {
  publications: [],
  publishedItems: [],
  selectedPublication: null,
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    init: (state) => state,
    publish: (
      state,
      _action: PayloadAction<{
        targetUrl: string;
        targetFolder: string;
        sourceUrl: string;
        rules: PublicationRule[];
      }>,
    ) => state,
    publishSuccess: (state, { payload }: PayloadAction<Publication>) => {
      state.publications = state.publications.concat(payload);
    },
    publishFail: (state) => state,
    uploadPublications: (
      state,
      _action: PayloadAction<{ url?: string; asAdmin: boolean }>,
    ) => state,
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
    deletePublication: (state, { payload }: PayloadAction<{ url: string }>) => {
      state.publications = state.publications.filter(
        (p) => p.url !== payload.url,
      );
    },
    deletePublicationFail: (state) => state,
    uploadPublishedItems: (
      state,
      _action: PayloadAction<{ featureType: ApiKeys }>,
    ) => state,
    uploadPublishedItemsSuccess: (
      state,
      { payload }: PayloadAction<{ publishedItems: PublishedItem }>,
    ) => {
      state.publishedItems = payload.publishedItems.items || [];
    },
    uploadPublishedItemsFail: (state) => state,
    uploadPublishedByMeItems: (
      state,
      _action: PayloadAction<{ resourceTypes: BackendResourceType[] }>,
    ) => state,
    uploadPublishedByMeItemsFail: (state) => state,
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
  },
});

export const PublicationActions = publicationSlice.actions;
