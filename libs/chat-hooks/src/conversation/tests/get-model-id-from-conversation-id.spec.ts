import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  findDeploymentForConversationId,
  getModelIdCandidatesFromConversationId,
  getModelIdFromConversationId,
} from '../get-model-id-from-conversation-id';

describe('getModelIdFromConversationId', () => {
  it('returns the deployment id for a simple (single-segment) deployment', () => {
    expect(
      getModelIdFromConversationId('conversations/bucket/gpt-4__My%20chat'),
    ).toBe('gpt-4');
  });

  it('returns the full deployment id for a multi-segment deployment', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/anthropic/claude-3__My%20chat',
      ),
    ).toBe('anthropic/claude-3');
  });

  it('returns the full deployment id for a three-segment deployment', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/provider/family/model__title',
      ),
    ).toBe('provider/family/model');
  });

  it('preserves percent-encoded characters in deployment id segments', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/my%20org/model__title',
      ),
    ).toBe('my%20org/model');
  });

  it('includes the version suffix of an application deployment id', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe('applications/catalog/Team%2FApp%20One__0.0.1');
  });

  it('does not mistake a bare-numeric title for a version suffix on a plain model deployment', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/gemini-3.1-flash-lite__18__0e2c7332-bf11-4026-b729-502b55bbbb77',
      ),
    ).toBe('gemini-3.1-flash-lite');
  });

  it('does not mistake a bare-numeric title for a version suffix on a scheduled-task conversation', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/.scheduler/schedule-id/gemini-3.1-flash-lite__18__0e2c7332-bf11-4026-b729-502b55bbbb77',
      ),
    ).toBe('gemini-3.1-flash-lite');
  });

  it('handles titles that contain double-underscore', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/gpt-4__title__with__underscores',
      ),
    ).toBe('gpt-4');
  });

  it('handles titles that contain slashes (e.g. a date in the title)', () => {
    // title contains slashes which create extra path segments after the separator
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/my-model-id__title%206/2/2026',
      ),
    ).toBe('my-model-id');
  });

  it('handles multi-segment deployment AND a title with slashes', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/anthropic/claude-3__report%206/2/2026',
      ),
    ).toBe('anthropic/claude-3');
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

  it('strips the reserved .scheduler/{scheduleId} prefix for scheduled-task conversations', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite__title__run-id',
      ),
    ).toBe('gemini-3.1-flash-lite');
  });

  it('strips the .scheduler prefix for a multi-segment deployment id', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/.scheduler/schedule-id/anthropic/claude-3__title__run-id',
      ),
    ).toBe('anthropic/claude-3');
  });

  it('keeps the version suffix of an application conversation stored in a folder', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/folder/applications/app-bucket/my-app__1.0__title',
      ),
    ).toBe('folder/applications/app-bucket/my-app__1.0');
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
  ] as DeploymentItemDto[];

  it('finds the deployment of a conversation stored in a folder', () => {
    expect(
      findDeploymentForConversationId(
        deployments,
        'conversations/bucket/qa-run-20260929/gpt-4o__title__uuid',
      )?.id,
    ).toBe('gpt-4o');
  });

  it('prefers the longest matching multi-segment deployment id', () => {
    expect(
      findDeploymentForConversationId(
        deployments,
        'conversations/bucket/folder/anthropic/claude-3__title',
      )?.id,
    ).toBe('anthropic/claude-3');
  });

  it('finds a versioned application conversation stored in a folder', () => {
    expect(
      findDeploymentForConversationId(
        deployments,
        'conversations/bucket/folder/applications/app-bucket/my-app__1.0__title',
      )?.id,
    ).toBe('applications/app-bucket/my-app__1.0');
  });

  it('matches a deployment by reference', () => {
    expect(
      findDeploymentForConversationId(
        deployments,
        'conversations/bucket/folder/gpt-4o-ref__title',
      )?.id,
    ).toBe('gpt-4o');
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
