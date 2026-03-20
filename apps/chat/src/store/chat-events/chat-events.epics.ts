import {
  EMPTY,
  catchError,
  concat,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ChatEventsService } from '@/src/utils/app/data/chat-events-service';

import { ChatEvent, ChatEventResponse } from '@/src/types/chat-events';
import { AppEpic } from '@/src/types/store';

import {
  ChatEventsActions,
  ConversationsActions,
  UIActions,
} from '@/src/store/actions';
import { ChatEventsSelectors } from '@/src/store/selectors';

const subscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ChatEventsActions.subscribe.type,
      ConversationsActions.sendMessage.type,
    ),
    filter(() => !ChatEventsSelectors.selectIsSubscribed(state$.value)),
    switchMap(() => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);
      const decoder = new TextDecoder();

      return ChatEventsService.subscribe(channelId).pipe(
        mergeMap((resp) => {
          if (resp.channelId) {
            return concat(
              of(ChatEventsActions.setIsSubscribed(true)),
              of(ChatEventsActions.setChannelId(resp.channelId)),
            );
          }
          if (resp.done) {
            return of(ChatEventsActions.setIsSubscribed(false));
          }

          return of(resp).pipe(
            map((chunk) =>
              chunk.value ? decoder.decode(chunk.value, { stream: true }) : '',
            ),
            filter((value) => value.includes('data:')),
            mergeMap((value) => {
              const data = value.split('data:')[1].trim();
              const parsedData = JSON.parse(data) as ChatEvent;

              return concat(
                of(ChatEventsActions.addEvent(parsedData)),
                of(
                  UIActions.showSuccessToast(
                    `[DEBUG] ${parsedData.method} event added for ${parsedData.params.toolsetId}`,
                  ),
                ),
              );
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ChatEventsActions.setIsSubscribed(false));
        }),
      );
    }),
  );

const unsubscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.unsubscribe.type),
    filter(() => ChatEventsSelectors.selectIsSubscribed(state$.value)),
    switchMap(() => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);

      if (!channelId) return EMPTY;

      return ChatEventsService.unsubscribe(channelId).pipe(
        switchMap(() => {
          return of(ChatEventsActions.setIsSubscribed(false));
        }),
      );
    }),
  );

const reportEventEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.reportEvent.type),
    switchMap(({ payload }) => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);
      if (!channelId) return EMPTY;

      const data: ChatEventResponse = {
        id: payload.id,
        result: 'success',
      };

      return ChatEventsService.report({ data, channelId }).pipe(
        switchMap(() => of(ChatEventsActions.reportEventSuccess(payload))),
        catchError((err) => {
          console.error(err);
          return of(ChatEventsActions.reportEventFailure(payload));
        }),
      );
    }),
  );

export const ChatEventsEpics = combineEpics(
  subscribeEpic,
  unsubscribeEpic,
  reportEventEpic,
);
