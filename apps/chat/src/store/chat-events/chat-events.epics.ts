import {
  EMPTY,
  catchError,
  concat,
  exhaustMap,
  filter,
  forkJoin,
  map,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ChatEventsService } from '@/src/utils/app/data/chat-events-service';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ChatEvent,
  ChatEventOperations,
  ChatEventResponse,
  ChatEventResult,
} from '@/src/types/chat-events';
import { AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  ChatEventsActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import { ChatEventsSelectors, SettingsSelectors } from '@/src/store/selectors';

import {
  RECONNECT_INTERVAL,
  RECONNECT_RETRY_COUNT,
} from '@/src/constants/chat-events';
import { ChatI18nKeys } from '@/src/constants/i18n';

import { Feature } from '@epam/ai-dial-shared';

const EVENTS_SEPARATOR = 'data:';

const mapChatEventFromApi = (event: ChatEvent): ChatEvent => ({
  ...event,
  params: {
    ...event.params,
    ...(event.params.toolsetId && {
      toolsetId: ApiUtils.decodeApiUrl(event.params.toolsetId),
    }),
  },
});

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.init.type),
    filter(() => !ChatEventsSelectors.selectIsInitialized(state$.value)),
    switchMap(() => concat(of(ChatEventsActions.initFinish()))),
  );

const subscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.subscribe.type),
    filter(
      () =>
        !ChatEventsSelectors.selectIsSubscribed(state$.value) &&
        SettingsSelectors.isFeatureEnabled(
          state$.value,
          Feature.LiveChatInteraction,
        ),
    ),
    exhaustMap(({ payload }) => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);
      const decoder = new TextDecoder();
      let retryAttempt = payload?.retryAttempt ?? 0;

      return ChatEventsService.subscribe(channelId).pipe(
        mergeMap((resp) => {
          if (resp.channelId) {
            retryAttempt = 0;
            return concat(
              of(ChatEventsActions.setChannelId(resp.channelId)),
              of(ChatEventsActions.setIsSubscribed(true)),
            );
          }
          if (resp.done) {
            return of(ChatEventsActions.subscribeFailure({ retryAttempt }));
          }

          return of(resp).pipe(
            map((chunk) =>
              chunk.value ? decoder.decode(chunk.value, { stream: true }) : '',
            ),
            filter((value) => value.includes('data:')),
            mergeMap((value) => {
              const data = value
                .split(EVENTS_SEPARATOR)
                .map((v) => v?.trim())
                .filter((v) => !!v);
              const parsedData = (
                data.map((v) => JSON.parse(v)) as ChatEvent[]
              ).map(mapChatEventFromApi);

              return of(ChatEventsActions.addEvents(parsedData));
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(
            ChatEventsActions.subscribeFailure({
              retryAttempt,
              traceId,
            }),
          );
        }),
        takeUntil(action$.pipe(ofType(ChatEventsActions.unsubscribe.type))),
      );
    }),
  );

const reconnectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.subscribeFailure.type),
    filter(
      ({ payload }) =>
        !ChatEventsSelectors.selectIsSubscribed(state$.value) &&
        (payload?.retryAttempt ?? 0) <= RECONNECT_RETRY_COUNT,
    ),
    switchMap(({ payload }) =>
      timer(RECONNECT_INTERVAL).pipe(
        map(() =>
          ChatEventsActions.subscribe({
            retryAttempt: (payload?.retryAttempt ?? 0) + 1,
          }),
        ),
      ),
    ),
  );

const unsubscribeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.unsubscribe.type),
    filter(() => ChatEventsSelectors.selectIsSubscribed(state$.value)),
    switchMap(() => {
      const channelId = ChatEventsSelectors.selectChannelId(state$.value);

      if (!channelId) return EMPTY;

      const resetSubscription$ = concat(
        of(ChatEventsActions.setIsSubscribed(false)),
        of(ChatEventsActions.setChannelId()),
        of(ChatEventsActions.clearEvents()),
      );

      return ChatEventsService.unsubscribe(channelId).pipe(
        switchMap(() => resetSubscription$),
        catchError((err) => {
          console.error(err);
          return resetSubscription$;
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
        id: payload.event.id,
        result: payload.result,
      };

      return ChatEventsService.report({ data, channelId }).pipe(
        switchMap(() => of(ChatEventsActions.reportEventSuccess(payload))),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(
            ChatEventsActions.reportEventFailure({ ...payload, traceId }),
          );
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

      return of(
        ChatEventsActions.reportEvent({
          event: resolvingEvent,
          result: ChatEventResult.Success,
        }),
      );
    }),
  );

const reportEventSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatEventsActions.reportEventSuccess.type),
    switchMap(({ payload }) => {
      if (
        payload.event.method === ChatEventOperations.ToolsetSignIn &&
        payload.result === ChatEventResult.Denied
      ) {
        return of(
          UIActions.showSuccessToast(
            translate(ChatI18nKeys.ToolsetSignInRequestDeclined, {
              ns: Translation.Chat,
            }),
          ),
        );
      }

      return EMPTY;
    }),
  );

const reportEventFailureEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatEventsActions.reportEventFailure.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message: translate(
            payload.result === ChatEventResult.Success
              ? ChatI18nKeys.FailedToResolveRequest
              : ChatI18nKeys.FailedToDeclineRequest,
            {
              ns: Translation.Chat,
            },
          ),
          traceId: payload.traceId,
        }),
      );
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
          const { traceId } = parseApiError(err);
          return of(
            ChatEventsActions.declineAllEventsFailure({ ...payload, traceId }),
          );
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
            translate(ChatI18nKeys.AllToolsetSignInRequestsDeclined, {
              ns: Translation.Chat,
            }),
          ),
        );
      }

      return EMPTY;
    }),
  );

const declineAllEventsFailureEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatEventsActions.declineAllEventsFailure.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message: translate(ChatI18nKeys.FailedToDeclineAllRequests, {
            ns: Translation.Chat,
          }),
          traceId: payload.traceId,
        }),
      );
    }),
  );

export const ChatEventsEpics = combineEpics(
  initEpic,
  subscribeEpic,
  reconnectEpic,
  unsubscribeEpic,
  reportEventEpic,
  reportEventSuccessEpic,
  reportEventFailureEpic,
  resolveToolsetLoginEpic,
  declineAllEventsEpic,
  declineAllEventsSuccessEpic,
  declineAllEventsFailureEpic,
);
