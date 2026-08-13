import { describe, expect, it } from 'vitest';
import {
  OverlayAuthUiMode,
  OverlayEventType,
  OverlayFeature,
  OverlayRequestErrorCode,
  OverlayRequestType,
  isOverlayMessageEvent,
  isOverlayMessageRequest,
  isOverlayMessageResponse,
} from '../overlay-protocol';

describe('OverlayAuthUiMode', () => {
  it('contains exactly the external and same-window modes', () => {
    expect(Object.values(OverlayAuthUiMode)).toEqual([
      'external',
      'sameWindow',
    ]);
  });
});

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

  it('accepts a response with a structured request error', () => {
    expect(
      isOverlayMessageResponse({
        type: `${OverlayRequestType.GetMessages}/RESPONSE`,
        requestId: 'abc',
        error: {
          code: OverlayRequestErrorCode.ActiveConversationUnavailable,
          message: 'No active conversation is open.',
        },
      }),
    ).toBe(true);
  });

  it('rejects a response with an unknown request error code', () => {
    expect(
      isOverlayMessageResponse({
        type: `${OverlayRequestType.GetMessages}/RESPONSE`,
        requestId: 'abc',
        error: { code: 'UNKNOWN', message: 'No active conversation is open.' },
      }),
    ).toBe(false);
  });
});

describe('OverlayFeature', () => {
  it('has exactly 35 unique members', () => {
    const values = Object.values(OverlayFeature);
    expect(values).toHaveLength(35);
    expect(new Set(values).size).toBe(35);
  });

  it('includes the prompts feature key', () => {
    expect(Object.values(OverlayFeature)).toContain('prompts');
  });

  it('includes the file-manager feature key', () => {
    expect(Object.values(OverlayFeature)).toContain('file-manager');
  });

  it('does not include the renamed marketplace keys', () => {
    const values = Object.values(OverlayFeature) as string[];
    ['marketplace', 'marketplace-hide-my-apps', 'marketplace-table-view'].forEach(
      (key) => {
        expect(values).not.toContain(key);
      },
    );
  });

  it('does not include keys whose behavior became unconditional', () => {
    const values = Object.values(OverlayFeature) as string[];
    [
      'custom-logo',
      'show-layout-dividers',
      'top-settings',
      'top-chat-model-settings',
      'chat-header-border',
      'chat-input-border',
    ].forEach((key) => {
      expect(values).not.toContain(key);
    });
  });

  it('includes the pre-existing and newly-added transferable keys', () => {
    const values = Object.values(OverlayFeature);
    expect(values).toContain('voice-input');
    expect(values).toContain('header');
    expect(values).toContain('likes');
    expect(values).toContain('hide-new-conversation');
    expect(values).toContain('live-chat-interaction');
  });

  it('does not include any of the 19 missing-status legacy keys', () => {
    const values = Object.values(OverlayFeature) as string[];
    const missingKeys = [
      'code-interpreter',
      'compare-mode-disabled',
      'input-links',
      'message-templates',
      'hide-top-context-menu',
      'top-chat-info',
      'top-clear-conversation',
      'chat-full-width-by-default',
      'footer',
      'prompts-panel-toggle',
      'prompts-section',
      'showPromptsSectionByDefault',
      'edit-all-assistant-message',
      'edit-last-assistant-message',
      'disabled-playback-controls',
      'prompts-publishing',
      'prompts-sharing',
      'report-an-issue',
      'request-api-key',
    ];
    missingKeys.forEach((key) => {
      expect(values).not.toContain(key);
    });
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
