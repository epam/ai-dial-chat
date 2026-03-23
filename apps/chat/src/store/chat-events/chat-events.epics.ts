import {
  EMPTY,
  catchError,
  concat,
  filter,
  forkJoin,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ChatEventsService } from '@/src/utils/app/data/chat-events-service';
import { translate } from '@/src/utils/app/translation';

import {
  ChatEvent,
  ChatEventOperations,
  ChatEventResponse,
  ChatEventResult,
} from '@/src/types/chat-events';
import { AppEpic } from '@/src/types/store';

import {
  ChatEventsActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import { ChatEventsSelectors } from '@/src/store/selectors';

import groupBy from 'lodash-es/groupBy';

const subscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ChatEventsActions.subscribe.type,
      // TODO: uncomment when core api for chat events is ready
      // ConversationsActions.sendMessage.type,
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

              return of(ChatEventsActions.addEvent(parsedData));
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
      if (!channelId) return of(ChatEventsActions.reportEventFailure(payload));

      const data: ChatEventResponse = {
        id: payload.id,
        result: ChatEventResult.Success,
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

const resolveToolsetLoginEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolsetSuccess.type),
    switchMap(({ payload }) => {
      const events = ChatEventsSelectors.selectEventsList(state$.value);
      const resolvingEvent = events.find(
        (e) => e.params.toolsetId === payload.toolsetId,
      );

      if (!resolvingEvent) return EMPTY;

      return of(ChatEventsActions.reportEvent(resolvingEvent));
    }),
  );

const reportEventSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.reportEventSuccess.type),
    switchMap(({ payload }) => {
      const events = ChatEventsSelectors.selectEventsList(state$.value);
      const { [ChatEventOperations.ToolsetSignIn]: toolsetSignInEvents } =
        groupBy(events, 'method');

      if (
        !toolsetSignInEvents?.length &&
        payload.method === ChatEventOperations.ToolsetSignIn
      ) {
        return of(
          UIActions.showSuccessToast(
            translate('All toolset sign in requests resolved'),
          ),
        );
      }

      return EMPTY;
    }),
  );

const declineAllEventsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.declineAllEvents.type),
    switchMap(({ payload }) => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);
      if (!channelId)
        return of(ChatEventsActions.declineAllEventsFailure(payload));

      const declinedEvents = ChatEventsSelectors.selectEventsList(
        state$.value,
      ).filter(({ method }) => method === payload.method);

      const requests = declinedEvents.map((event) => {
        const data: ChatEventResponse = {
          id: event.id,
          result: ChatEventResult.Denied,
        };

        return ChatEventsService.report({ data, channelId });
      });

      return forkJoin(requests).pipe(
        switchMap(() => of(ChatEventsActions.declineAllEventsSuccess(payload))),
        catchError((err) => {
          console.error(err);
          return of(ChatEventsActions.declineAllEventsFailure(payload));
        }),
      );
    }),
  );

const declineAllEventsSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatEventsActions.declineAllEventsSuccess.type),
    switchMap(({ payload }) => {
      if (payload.method === ChatEventOperations.ToolsetSignIn) {
        return of(
          UIActions.showSuccessToast(
            translate('All toolset sign in requests declined'),
          ),
        );
      }

      return EMPTY;
    }),
  );

export const ChatEventsEpics = combineEpics(
  subscribeEpic,
  unsubscribeEpic,
  reportEventEpic,
  resolveToolsetLoginEpic,
  reportEventSuccessEpic,
  declineAllEventsEpic,
  declineAllEventsSuccessEpic,
);
