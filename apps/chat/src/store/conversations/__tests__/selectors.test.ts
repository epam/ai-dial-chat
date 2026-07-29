import { describe, expect, it } from 'vitest';

import { DialAIEntityModel } from '@/src/types/models';

import { ConversationsSelectors } from '@/src/store/selectors';

const model = (
  id: string,
  inputAttachmentTypes?: string[],
): DialAIEntityModel => ({ id, inputAttachmentTypes }) as DialAIEntityModel;

const buildState = (models: DialAIEntityModel[]) =>
  ({
    conversations: {
      conversations: models.map((m, i) => ({
        id: `conv-${i}`,
        model: { id: m.id },
      })),
      selectedConversationsIds: models.map((_, i) => `conv-${i}`),
    },
    models: {
      modelsMap: Object.fromEntries(models.map((m) => [m.id, m])),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('ConversationsSelectors.selectAvailableAttachmentsTypes', () => {
  it('returns the single model types when only one conversation is selected', () => {
    const state = buildState([model('m1', ['image/*'])]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/*']);
  });

  it('keeps the narrower type when one compare model allows all types (image/* × */*)', () => {
    const state = buildState([model('m1', ['image/*']), model('m2', ['*/*'])]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/*']);
  });

  it('is order independent (*/* × image/*)', () => {
    const state = buildState([model('m1', ['*/*']), model('m2', ['image/*'])]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/*']);
  });

  it('keeps the concrete type against a subset wildcard (image/png × image/*)', () => {
    const state = buildState([
      model('m1', ['image/png']),
      model('m2', ['image/*']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/png']);
  });

  it('intersects overlapping concrete types and de-duplicates', () => {
    const state = buildState([
      model('m1', ['image/png', 'application/pdf']),
      model('m2', ['image/png', 'text/plain']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/png']);
  });

  it('keeps every type shared by both models (identical lists)', () => {
    const state = buildState([
      model('m1', ['image/png', 'application/pdf', 'text/plain']),
      model('m2', ['image/png', 'application/pdf', 'text/plain']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/png', 'application/pdf', 'text/plain']);
  });

  it('keeps all shared types when they overlap partially', () => {
    const state = buildState([
      model('m1', ['image/png', 'application/pdf', 'text/csv']),
      model('m2', ['application/pdf', 'text/csv', 'text/plain']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['application/pdf', 'text/csv']);
  });

  it('keeps all of the narrower model types when the other allows all types', () => {
    const state = buildState([
      model('m1', ['image/*', 'text/csv']),
      model('m2', ['*/*']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual(['image/*', 'text/csv']);
  });

  it('returns undefined when the two models share no supported types', () => {
    const state = buildState([
      model('m1', ['image/*']),
      model('m2', ['text/plain']),
    ]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toBeUndefined();
  });

  it('returns an empty array when no conversation is selected', () => {
    const state = buildState([]);

    expect(
      ConversationsSelectors.selectAvailableAttachmentsTypes(state),
    ).toEqual([]);
  });
});
