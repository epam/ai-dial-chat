import { Observable, switchMap, tap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { toClientChannelFormat } from '@/src/utils/app/chat-events';
import { ApiUtils } from '@/src/utils/server/api';

import { ChatEventResponse } from '@/src/types/chat-events';
import { HTTPMethod } from '@/src/types/http';

import { HeadersNames } from '@/src/constants/server';

export class ChatEventsService {
  private static abortController: AbortController | null = null;

  private static createAbortController() {
    if (this.abortController && !this.abortController.signal.aborted) {
      return this.abortController;
    }

    this.abortController = new AbortController();
    return this.abortController;
  }

  public static subscribe(channelId?: string): Observable<
    ReadableStreamReadResult<Uint8Array<ArrayBufferLike>> & {
      channelId?: string | null;
    }
  > {
    if (this.abortController?.signal && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    return fromFetch('/api/client-channels/subscribe', {
      method: HTTPMethod.POST,
      headers: {
        Accept: 'text/event-stream',
        ...(channelId && {
          [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: channelId,
        }),
      },
      signal: this.createAbortController().signal,
    }).pipe(
      switchMap((response) => {
        const body = response.body;

        if (!response.ok) {
          return throwError(
            () => new Error('ServerError', { cause: response }),
          );
        }

        if (!body) {
          return throwError(() => new Error('No body received'));
        }

        const reader = body.getReader();

        return new Observable<
          ReadableStreamReadResult<Uint8Array> & { channelId?: string | null }
        >((subscriber) => {
          subscriber.next({
            done: false,
            value: undefined as unknown as Uint8Array<ArrayBufferLike>,
            channelId:
              response.headers.get(HeadersNames.X_DIAL_CLIENT_CHANNEL_ID) ??
              channelId,
          });

          const run = async () => {
            try {
              while (true) {
                const val = await reader.read();
                subscriber.next(val);

                if (val.done) {
                  subscriber.complete();
                  break;
                }
              }
            } catch (e) {
              subscriber.error(e);
              subscriber.complete();
            }
          };

          void run();

          return () => {
            void reader.cancel();
          };
        });
      }),
    );
  }

  public static unsubscribe(channelId: string): Observable<void> {
    return ApiUtils.request('/api/client-channels/unsubscribe', {
      method: HTTPMethod.POST,
      headers: {
        [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: channelId,
      },
    }).pipe(tap(() => this.abortController?.abort?.()));
  }

  public static report({
    data,
    channelId,
  }: {
    data: ChatEventResponse;
    channelId: string;
  }): Observable<void> {
    return ApiUtils.request('/api/client-channels/report', {
      method: HTTPMethod.POST,
      headers: {
        [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: channelId,
      },
      body: JSON.stringify(toClientChannelFormat(data)),
    });
  }
}
