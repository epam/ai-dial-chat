import {
  EMPTY,
  filter,
  first,
  fromEvent,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { AppEpic } from '@/src/types/store';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { OverlayEventsActions } from './overlay-events.reducers';

const overlayAppName = '@DIAL_OVERLAY';

export enum OverlayRequests {
  getMessages = 'GET_MESSAGES',
}

export enum OverlayEvents {
  ready = 'READY',
}

// TODO: Make handshake for overlay and host (remove broadcasting '*')
const sendResponseToHost = (
  type: string,
  requestId: string,
  payload: unknown,
) => {
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}/RESPONSE`,
      requestId,
      payload,
    },
    '*',
  );
};

const sendEventToHost = (type: string, payload: unknown) => {
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}`,
      payload,
    },
    '*',
  );
};

const isOverlayRequest = (event: MessageEvent): boolean =>
  event.data?.type && // has type
  event.data?.requestId && // has requestId
  event.data?.type.startsWith(overlayAppName); // type starts with overlayAppName, that means messages come to overlay, we should handle it

const postMessageMapperEpic: AppEpic = () =>
  typeof window === 'object'
    ? fromEvent<MessageEvent>(window, 'message').pipe(
        filter(isOverlayRequest),
        map((event) => {
          const data = event.data as {
            type: string;
            requestId: string;
          };

          const request = data.type.replace(
            `${overlayAppName}/`,
            '',
          ) as OverlayRequests;

          const requestId = data.requestId;

          return { request, requestId };
        }),
        switchMap(({ request, requestId }) => {
          switch (request) {
            case OverlayRequests.getMessages: {
              return of(OverlayEventsActions.getMessages({ requestId }));
            }
            default: {
              // it's not supported overlay request
              return EMPTY;
            }
          }
        }),
      )
    : EMPTY;

const getLastConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayEventsActions.getMessages.match),
    tap(({ payload: { requestId } }) => {
      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);

      sendResponseToHost(OverlayRequests.getMessages, requestId, {
        messages: selectedConversations.length
          ? selectedConversations[0].messages
          : [],
      });
    }),
    ignoreElements(),
  );

const notifyHostAboutReadyEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.updateConversations.match),
    first(),
    tap(() => {
      sendEventToHost(OverlayEvents.ready, undefined);
    }),
    ignoreElements(),
  );

export const OverlayEventsEpics = combineEpics(
  postMessageMapperEpic,
  getLastConversationEpic,
  notifyHostAboutReadyEpic,
);
