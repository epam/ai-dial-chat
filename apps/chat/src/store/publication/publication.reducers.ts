import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { BackendResourceType } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationsListModel,
  PublishedItem,
} from '@/src/types/publication';

import { RootState } from '../index';

export interface PublicationState {
  publications: PublicationInfo[];
  publishedConversations: PublishedItem[];
}

const initialState: PublicationState = {
  publications: [],
  publishedConversations: [],
};

export const publicationSlice = createSlice({
  name: 'publication',
  initialState,
  reducers: {
    publish: (
      state,
      _action: PayloadAction<{
        targetUrl: string;
        targetFolder: string;
        sourceUrl: string;
      }>,
    ) => state,
    publishSuccess: (state, { payload }: PayloadAction<Publication>) => {
      state.publications = state.publications.concat(payload);
    },
    publishFail: (state) => state,
    uploadPublications: (state, _action: PayloadAction<{ url: string }>) =>
      state,
    uploadPublicationsSuccess: (
      state,
      { payload }: PayloadAction<PublicationsListModel>,
    ) => {
      state.publications = state.publications.concat(payload.publications);
    },
    uploadPublicationsFail: (state) => state,
    uploadPublication: (state, _action: PayloadAction<{ url: string }>) =>
      state,
    uploadPublicationSuccess: (
      state,
      { payload }: PayloadAction<Publication>,
    ) => {
      state.publications = state.publications.map((p) =>
        p.url === payload.url ? { ...payload, ...p } : p,
      );
    },
    uploadPublicationFail: (state) => state,
    deletePublication: (state, { payload }: PayloadAction<{ url: string }>) => {
      state.publications = state.publications.filter(
        (p) => p.url !== payload.url,
      );
    },
    deletePublicationFail: (state) => state,
    uploadPublishedConversations: (state) => state,
    uploadPublishedConversationsSuccess: (
      state,
      { payload }: PayloadAction<{ publishedConversations: PublishedItem[] }>,
    ) => {
      state.publishedConversations = payload.publishedConversations;
    },
    uploadPublishedConversationsFail: (state) => state,
    uploadPublishedByMeItems: (
      state,
      _action: PayloadAction<{ resourceTypes: BackendResourceType[] }>,
    ) => state,
    uploadPublishedByMeItemsFail: (state) => state,
    approvePublication: (state, _actions: PayloadAction<{ url: string }>) =>
      state,
    approvePublicationFail: (state) => state,
    rejectPublication: (state, _actions: PayloadAction<{ url: string }>) =>
      state,
    rejectPublicationFail: (state) => state,
  },
});

const rootSelector = (state: RootState): PublicationState => state.publication;

export const PublicationSelectors = {};

export const PublicationActions = publicationSlice.actions;
