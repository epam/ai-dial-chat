import { describe, expect, it } from 'vitest';
import {
  OverlayEventType,
  OverlayRequestType,
  isOverlayMessageEvent,
  isOverlayMessageRequest,
  isOverlayMessageResponse,
} from '../overlay-protocol';

describe('isOverlayMessageRequest', () => {
  it('accepts a well-formed request', () => {
    expect(
      isOverlayMessageRequest({
        type: OverlayRequestType.GetMessages,
        requestId: 'abc',
        expiresAt: 1000,
      }),
    ).toBe(true);
  });

  it('rejects a response type', () => {
    expect(
      isOverlayMessageRequest({
        type: `${OverlayRequestType.GetMessages}/RESPONSE`,
        requestId: 'abc',
      }),
    ).toBe(false);
  });

  it('rejects a missing requestId', () => {
    expect(
      isOverlayMessageRequest({ type: OverlayRequestType.GetMessages }),
    ).toBe(false);
  });

  it('rejects a non-numeric expiresAt', () => {
    expect(
      isOverlayMessageRequest({
        type: OverlayRequestType.GetMessages,
        requestId: 'abc',
        expiresAt: '1000',
      }),
    ).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isOverlayMessageRequest(null)).toBe(false);
    expect(isOverlayMessageRequest('nope')).toBe(false);
  });
});

describe('isOverlayMessageResponse', () => {
  it('accepts a well-formed response', () => {
    expect(
      isOverlayMessageResponse({
        type: `${OverlayRequestType.SendMessage}/RESPONSE`,
        requestId: 'abc',
      }),
    ).toBe(true);
  });

  it('rejects a bare request type', () => {
    expect(
      isOverlayMessageResponse({
        type: OverlayRequestType.SendMessage,
        requestId: 'abc',
      }),
    ).toBe(false);
  });

  it('rejects an unknown request type response', () => {
    expect(
      isOverlayMessageResponse({
        type: '@DIAL_OVERLAY/NOT_A_REQUEST/RESPONSE',
        requestId: 'abc',
      }),
    ).toBe(false);
  });
});

describe('isOverlayMessageEvent', () => {
  it('accepts a well-formed event', () => {
    expect(isOverlayMessageEvent({ type: OverlayEventType.Ready })).toBe(true);
  });

  it('rejects an event-shaped object carrying a requestId', () => {
    expect(
      isOverlayMessageEvent({ type: OverlayEventType.Ready, requestId: 'abc' }),
    ).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(isOverlayMessageEvent({ type: '@DIAL_OVERLAY/NOT_AN_EVENT' })).toBe(
      false,
    );
  });
});
