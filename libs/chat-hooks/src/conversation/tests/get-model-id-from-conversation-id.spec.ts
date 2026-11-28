import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  findDeploymentForConversationId,
  getModelIdCandidatesFromConversationId,
  getModelIdFromConversationId,
} from '../get-model-id-from-conversation-id';

describe('getModelIdFromConversationId', () => {
  it.each([
    [
      'returns the deployment id for a simple (single-segment) deployment',
      { id: 'conversations/bucket/gpt-4__My%20chat', expected: 'gpt-4' },
    ],
    [
      'returns the full deployment id for a multi-segment deployment',
      {
        id: 'conversations/bucket/anthropic/claude-3__My%20chat',
        expected: 'anthropic/claude-3',
      },
    ],
    [
      'returns the full deployment id for a three-segment deployment',
      {
        id: 'conversations/bucket/provider/family/model__title',
        expected: 'provider/family/model',
      },
    ],
    [
      'preserves percent-encoded characters in deployment id segments',
      {
        id: 'conversations/bucket/my%20org/model__title',
        expected: 'my%20org/model',
      },
    ],
    [
      'includes the version suffix of an application deployment id',
      {
        id: 'conversations/bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
        expected: 'applications/catalog/Team%2FApp%20One__0.0.1',
      },
    ],
    [
      'does not mistake a bare-numeric title for a version suffix on a plain model deployment',
      {
        id: 'conversations/bucket/gemini-3.1-flash-lite__18__0e2c7332-bf11-4026-b729-502b55bbbb77',
        expected: 'gemini-3.1-flash-lite',
      },
    ],
    [
      'does not mistake a bare-numeric title for a version suffix on a scheduled-task conversation',
      {
        id: 'conversations/bucket/.scheduler/schedule-id/gemini-3.1-flash-lite__18__0e2c7332-bf11-4026-b729-502b55bbbb77',
        expected: 'gemini-3.1-flash-lite',
      },
    ],
    [
      'handles titles that contain double-underscore',
      {
        id: 'conversations/bucket/gpt-4__title__with__underscores',
        expected: 'gpt-4',
      },
    ],
    [
      'handles titles that contain slashes (e.g. a date in the title)',
      // title contains slashes which create extra path segments after the separator
      {
        id: 'conversations/bucket/my-model-id__title%206/2/2026',
        expected: 'my-model-id',
      },
    ],
    [
      'handles multi-segment deployment AND a title with slashes',
      {
        id: 'conversations/bucket/anthropic/claude-3__report%206/2/2026',
        expected: 'anthropic/claude-3',
      },
    ],
    [
      'strips the reserved .scheduler/{scheduleId} prefix for scheduled-task conversations',
      {
        id: 'conversations/bucket/.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite__title__run-id',
        expected: 'gemini-3.1-flash-lite',
      },
    ],
    [
      'strips the .scheduler prefix for a multi-segment deployment id',
      {
        id: 'conversations/bucket/.scheduler/schedule-id/anthropic/claude-3__title__run-id',
        expected: 'anthropic/claude-3',
      },
    ],
    [
      'keeps the version suffix of an application conversation stored in a folder',
      {
        id: 'conversations/bucket/folder/applications/app-bucket/my-app__1.0__title',
        expected: 'folder/applications/app-bucket/my-app__1.0',
      },
    ],
    [
      'keeps the version suffix of a public application nested in folders',
      {
        id: 'conversations/bucket/applications/public/epam/agent/epam-agent__1.0.0__fdfddff__9a4f30a6-6441-4e98-b584-e2510646943b',
        expected: 'applications/public/epam/agent/epam-agent__1.0.0',
      },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(getModelIdFromConversationId(id)).toBe(expected);
  });

  it('returns undefined when there is no double-underscore separator', () => {
    expect(
      getModelIdFromConversationId('conversations/bucket/gpt-4-no-title'),
    ).toBe(undefined);
  });

  it('returns undefined for a path shorter than 3 segments', () => {
    expect(getModelIdFromConversationId('bucket/gpt-4__title')).toBe(undefined);
    expect(getModelIdFromConversationId('gpt-4__title')).toBe(undefined);
  });

  it('handles an empty string gracefully', () => {
    expect(getModelIdFromConversationId('')).toBe(undefined);
  });
});

describe('getModelIdCandidatesFromConversationId', () => {
  it('lists every path suffix of the extracted id, longest first', () => {
    expect(
      getModelIdCandidatesFromConversationId(
        'conversations/bucket/folder/anthropic/claude-3__title',
      ),
    ).toEqual(['folder/anthropic/claude-3', 'anthropic/claude-3', 'claude-3']);
  });

  it('returns an empty array for an unrecognised id', () => {
    expect(
      getModelIdCandidatesFromConversationId('bucket/gpt-4__title'),
    ).toEqual([]);
  });
});

describe('findDeploymentForConversationId', () => {
  const deployments = [
    { id: 'gpt-4o', reference: 'gpt-4o-ref' },
    { id: 'anthropic/claude-3' },
    { id: 'claude-3' },
    { id: 'applications/app-bucket/my-app__1.0' },
    { id: 'applications/public/epam/agent/epam-agent__1.0.0' },
  ] as DeploymentItemDto[];

  it.each([
    [
      'finds a versioned public application nested in folders',
      {
        id: 'conversations/bucket/applications/public/epam/agent/epam-agent__1.0.0__title__uuid',
        expected: 'applications/public/epam/agent/epam-agent__1.0.0',
      },
    ],
    [
      'finds the deployment of a conversation stored in a folder',
      {
        id: 'conversations/bucket/qa-run-20260929/gpt-4o__title__uuid',
        expected: 'gpt-4o',
      },
    ],
    [
      'prefers the longest matching multi-segment deployment id',
      {
        id: 'conversations/bucket/folder/anthropic/claude-3__title',
        expected: 'anthropic/claude-3',
      },
    ],
    [
      'finds a versioned application conversation stored in a folder',
      {
        id: 'conversations/bucket/folder/applications/app-bucket/my-app__1.0__title',
        expected: 'applications/app-bucket/my-app__1.0',
      },
    ],
    [
      'matches a deployment by reference',
      {
        id: 'conversations/bucket/folder/gpt-4o-ref__title',
        expected: 'gpt-4o',
      },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(findDeploymentForConversationId(deployments, id)?.id).toBe(expected);
  });

  it('returns undefined when no candidate matches', () => {
    expect(
      findDeploymentForConversationId(
        deployments,
        'conversations/bucket/folder/unknown__title',
      ),
    ).toBeUndefined();
  });
});
