import { describe, expect, it } from 'vitest';
import {
  collectConversationResourceUrls,
  getInvitationRoutePath,
  isAlreadyOwnedError,
  resolveResourceKind,
  toShareResourceUrl,
} from '../share-resource.util';

describe('resolveResourceKind', () => {
  it.each([
    ['applications/owner-bucket/my-app', 'APPLICATION'],
    ['toolsets/owner-bucket/my-toolset', 'TOOL_SET'],
    ['conversations/owner-bucket/my-chat', 'CONVERSATION'],
    ['skills/owner-bucket/team-a/docs-helper', 'SKILL'],
    ['prompts/owner-bucket/Work/AI/summarize', 'PROMPT'],
  ])('maps %s to %s', (itemId, kind) => {
    expect(resolveResourceKind(itemId)).toBe(kind);
  });

  it('throws for an unrecognized itemId prefix', () => {
    expect(() => resolveResourceKind('unknown/x/y')).toThrow(
      'Unrecognized resource kind for itemId: unknown/x/y',
    );
  });
});

describe('toShareResourceUrl', () => {
  it('percent-encodes a prompt resource id containing spaces', () => {
    expect(
      toShareResourceUrl('prompts/owner-bucket/Work/AI/tone of voice'),
    ).toBe('prompts/owner-bucket/Work/AI/tone%20of%20voice');
  });

  it('leaves a full prompts/{bucket}/{path} itemId unmodified when already encoded', () => {
    expect(toShareResourceUrl('prompts/my-bucket/Work/AI/summarize')).toBe(
      'prompts/my-bucket/Work/AI/summarize',
    );
  });

  it('leaves any non-prompt itemId untouched, with no per-kind qualification', () => {
    expect(toShareResourceUrl('applications/other-bucket/my-app')).toBe(
      'applications/other-bucket/my-app',
    );
  });

  it('leaves a skill itemId with a space unmodified', () => {
    expect(toShareResourceUrl('skills/owner-bucket/team a/docs helper')).toBe(
      'skills/owner-bucket/team a/docs helper',
    );
  });
});

describe('getInvitationRoutePath', () => {
  it('routes a conversation itemId to the conversation accept-invitation path', () => {
    expect(getInvitationRoutePath('conversations/bucket/my-chat.json')).toBe(
      '/conversations/shared',
    );
  });

  it('routes any other itemId to the catalog accept-invitation path', () => {
    expect(getInvitationRoutePath('applications/my-bucket/my-app')).toBe(
      '/catalog/shared',
    );
    expect(getInvitationRoutePath('prompts/my-bucket/Work/AI/summarize')).toBe(
      '/catalog/shared',
    );
  });
});

describe('isAlreadyOwnedError', () => {
  it('detects a DIAL Core "already belong to you" error body', () => {
    expect(isAlreadyOwnedError('Resource gpt-4o already belong to you')).toBe(
      true,
    );
  });

  it('is case-insensitive', () => {
    expect(isAlreadyOwnedError('RESOURCE ALREADY BELONG TO YOU')).toBe(true);
  });

  it('returns false for an unrelated error body', () => {
    expect(isAlreadyOwnedError('Invitation has expired')).toBe(false);
  });

  it('returns false for a non-string error body', () => {
    expect(isAlreadyOwnedError({ message: 'already belong' })).toBe(false);
  });
});

describe('collectConversationResourceUrls', () => {
  it('collects unique file attachments referenced by messages, stages, and citations', () => {
    const conversation = {
      messages: [
        {
          custom_content: {
            attachments: [
              { url: 'files/owner-bucket/report.pdf' },
              { url: 'https://example.com/public.pdf' },
              { data: 'aW5saW5l' },
            ],
            annotations: [
              {
                body: {
                  source: {
                    attachment: { url: 'files/owner-bucket/citation.pdf' },
                  },
                },
              },
            ],
          },
        },
        {
          custom_content: {
            attachments: [
              { url: 'files/owner-bucket/report.pdf' },
              { reference_url: 'files/owner-bucket/source.pdf#page=2' },
            ],
            stages: [
              {
                attachments: [{ url: 'files/owner-bucket/generated.csv' }],
              },
            ],
          },
        },
      ],
    };

    expect(collectConversationResourceUrls(conversation)).toEqual([
      'files/owner-bucket/report.pdf',
      'files/owner-bucket/citation.pdf',
      'files/owner-bucket/source.pdf',
      'files/owner-bucket/generated.csv',
    ]);
  });

  it('returns an empty array when the conversation has no messages', () => {
    expect(collectConversationResourceUrls({})).toEqual([]);
    expect(collectConversationResourceUrls(null)).toEqual([]);
    expect(collectConversationResourceUrls(undefined)).toEqual([]);
  });
});
