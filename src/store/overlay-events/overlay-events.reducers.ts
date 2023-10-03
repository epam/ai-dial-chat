import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const overlayEventsSlice = createSlice({
  name: 'overlay-events',
  initialState: {},
  reducers: {
    getMessages: (state, _action: PayloadAction<{ requestId: string }>) =>
      state,
  },
});

export const OverlayEventsActions = overlayEventsSlice.actions;
