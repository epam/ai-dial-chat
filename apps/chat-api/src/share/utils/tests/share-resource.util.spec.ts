import { describe, expect, it } from 'vitest';
import {
  collectApplicationPromptResourceUrls,
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

describe('collectApplicationPromptResourceUrls', () => {
  it('returns the prompt url for a single dial-prompt skill', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'dial-prompt', url: 'prompts/owner-bucket/my-prompt' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/my-prompt']);
  });

  it('deduplicates repeated prompt urls in first-seen order', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'dial-prompt', url: 'prompts/owner-bucket/first' },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/second' },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/first' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/first', 'prompts/owner-bucket/second']);
  });

  it('deduplicates encoded and unencoded forms of the same prompt url', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'dial-prompt', url: 'prompts/owner-bucket/My prompt' },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/My%20prompt' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/My%20prompt']);
  });

  it('ignores non-dial-prompt skill entries', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'custom', content: 'inline' },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
            { type: 'unknown-kind', url: 'prompts/owner-bucket/dropped' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('drops urls that are not DIAL prompt resource urls', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'dial-prompt', url: 'files/owner-bucket/report.pdf' },
            { type: 'dial-prompt', url: 'https://example.com/prompt' },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('strips a #-fragment suffix from a skill url', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            {
              type: 'dial-prompt',
              url: 'prompts/owner-bucket/my-prompt#variables',
            },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/other' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/my-prompt', 'prompts/owner-bucket/other']);
  });

  it('drops a skill url containing a `..` path-traversal segment', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            {
              type: 'dial-prompt',
              url: 'prompts/owner-bucket/../../other-bucket/target',
            },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('drops a percent-encoded `..` traversal segment that decodes after normalization', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            {
              type: 'dial-prompt',
              url: 'prompts/owner-bucket/%2E%2E/other-bucket/target',
            },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('drops a `..` traversal hidden behind a percent-encoded slash (`%2F`)', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            {
              type: 'dial-prompt',
              url: 'prompts/owner-bucket/..%2F..%2Fother-bucket/target',
            },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('skips entries whose url is not a string', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            { type: 'dial-prompt', url: 42 },
            { type: 'dial-prompt', url: { path: 'prompts/x/y' } },
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('skips entries that are not objects', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: {
          skills: [
            null,
            'prompts/owner-bucket/stray',
            { type: 'dial-prompt', url: 'prompts/owner-bucket/kept' },
          ],
        },
      }),
    ).toEqual(['prompts/owner-bucket/kept']);
  });

  it('returns [] when skills is not an array', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: { skills: 'not-an-array' },
      }),
    ).toEqual([]);
  });

  it('returns [] when application_properties is not an object', () => {
    expect(
      collectApplicationPromptResourceUrls({
        application_properties: 'not-an-object',
      }),
    ).toEqual([]);
  });

  it('returns [] when application_properties is absent', () => {
    expect(collectApplicationPromptResourceUrls({})).toEqual([]);
  });

  it('returns [] when the application itself is not an object', () => {
    expect(collectApplicationPromptResourceUrls(null)).toEqual([]);
    expect(collectApplicationPromptResourceUrls(undefined)).toEqual([]);
    expect(collectApplicationPromptResourceUrls('string')).toEqual([]);
  });
});
