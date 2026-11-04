import {
  ResponseError,
  ShareInvitationErrorCode,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS,
  resolveAcceptShareInvitationError,
} from '../share-invitation-error';
import { AcceptShareInvitationErrorKind } from '../types';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

const makeResponseError = (
  status: number,
  body: Record<string, unknown>,
): ResponseError =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('resolveAcceptShareInvitationError', () => {
  it('classifies an expired link without a Request ID', async () => {
    const error = makeResponseError(404, {
      statusCode: 404,
      code: ShareInvitationErrorCode.ShareInvitationNotFound,
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });

    expect(await resolveAcceptShareInvitationError(error)).toEqual({
      kind: AcceptShareInvitationErrorKind.NotFound,
      message: DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS.notFound,
      cause: error,
    });
  });

  it('names the shared item when the users limit is reached and the backend sent its name', async () => {
    const error = makeResponseError(400, {
      statusCode: 400,
      code: ShareInvitationErrorCode.ShareInvitationAcceptedUsersLimitReached,
      itemName: 'Quarterly plan',
    });

    expect(await resolveAcceptShareInvitationError(error)).toEqual({
      kind: AcceptShareInvitationErrorKind.UsersLimitReached,
      message:
        '"Quarterly plan" has already been shared with the maximum specified number of users.',
      itemName: 'Quarterly plan',
      cause: error,
    });
  });

  it('uses the unnamed users-limit sentence when the backend sent no item name', async () => {
    const error = makeResponseError(400, {
      statusCode: 400,
      code: ShareInvitationErrorCode.ShareInvitationAcceptedUsersLimitReached,
    });

    const result = await resolveAcceptShareInvitationError(error);

    expect(result.kind).toBe(AcceptShareInvitationErrorKind.UsersLimitReached);
    expect(result.message).toBe(
      DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS.usersLimitReachedUnnamed,
    );
    expect(result.itemName).toBeUndefined();
  });

  it('keeps the backend message and Request ID for any other failure', async () => {
    const error = makeResponseError(502, {
      statusCode: 502,
      message: 'DIAL Core is unavailable',
      traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    });

    expect(await resolveAcceptShareInvitationError(error)).toEqual({
      kind: AcceptShareInvitationErrorKind.Failed,
      message: 'DIAL Core is unavailable',
      requestId: TRACE_ID,
      cause: error,
    });
  });

  it('uses the thrown Error message when there is no response', async () => {
    const result = await resolveAcceptShareInvitationError(
      new Error('not found'),
    );

    expect(result.kind).toBe(AcceptShareInvitationErrorKind.Failed);
    expect(result.message).toBe('not found');
    expect(result.requestId).toBeUndefined();
  });

  it('falls back to the generic sentence when the error has no message', async () => {
    const result = await resolveAcceptShareInvitationError({});

    expect(result.message).toBe(
      DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS.acceptError,
    );
  });

  it('uses the host labels over the English defaults', async () => {
    const error = makeResponseError(400, {
      statusCode: 400,
      code: ShareInvitationErrorCode.ShareInvitationAcceptedUsersLimitReached,
      itemName: 'Plan',
    });

    const result = await resolveAcceptShareInvitationError(error, {
      usersLimitReached: (name) => `limit:${name}`,
    });

    expect(result.message).toBe('limit:Plan');
  });
});
