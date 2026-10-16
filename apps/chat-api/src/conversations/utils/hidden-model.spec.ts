import { ForbiddenException, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DeploymentsService } from '../../deployments/deployments.service';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';
import { assertModelNotHidden, getConversationModelId } from './hidden-model';

const makeDeployments = (resolved: unknown) =>
  ({
    resolveDeploymentItem: vi.fn().mockResolvedValue(resolved),
  }) as unknown as DeploymentsService;

const logger = new Logger('test');

describe('getConversationModelId', () => {
  it('prefers assistantModelId, the model the conversation uses now', () => {
    expect(
      getConversationModelId({
        assistantModelId: 'nova-lite',
        model: { id: 'gpt-4o' },
      }),
    ).toBe('nova-lite');
  });

  it('falls back to model.id', () => {
    expect(getConversationModelId({ model: { id: 'gpt-4o' } })).toBe('gpt-4o');
  });

  it('returns undefined when neither is set', () => {
    expect(getConversationModelId({})).toBeUndefined();
  });
});

describe('assertModelNotHidden', () => {
  it('throws ForbiddenException with conversationModelHidden for a hidden model', async () => {
    const error = await assertModelNotHidden(
      makeDeployments({ id: 'gpt-4o', isHidden: true }),
      'gpt-4o',
      'token',
      'bucket',
      logger,
      'test',
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: ConversationErrorCode.ModelHidden,
    });
  });

  it.each([
    ['a visible model', { id: 'gpt-4o', isHidden: false }],
    ['an unknown model', null],
  ])('resolves for %s', async (_label, resolved) => {
    await expect(
      assertModelNotHidden(
        makeDeployments(resolved),
        'gpt-4o',
        'token',
        'bucket',
        logger,
        'test',
      ),
    ).resolves.toBeUndefined();
  });

  it('does not look anything up when there is no model id', async () => {
    const deployments = makeDeployments(null);

    await assertModelNotHidden(
      deployments,
      undefined,
      'token',
      'bucket',
      logger,
      'test',
    );

    expect(deployments.resolveDeploymentItem).not.toHaveBeenCalled();
  });
});
