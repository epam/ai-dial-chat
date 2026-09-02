import { ConversationTransferUnitKind } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  buildTransferProgress,
  computeTransferPercent,
  ConversationTransferKind,
  ConversationTransferPhase,
  TRANSFER_PHASE_WEIGHTS,
} from '../progress';

describe('TRANSFER_PHASE_WEIGHTS', () => {
  it('every kind sums to 100', () => {
    for (const weights of Object.values(TRANSFER_PHASE_WEIGHTS)) {
      const sum =
        weights[ConversationTransferPhase.Prepare] +
        weights[ConversationTransferPhase.Transfer] +
        weights[ConversationTransferPhase.Finalize];
      expect(sum).toBe(100);
    }
  });
});

describe('computeTransferPercent', () => {
  it('credits an unsubdivided phase in full', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingleWithAttachments,
        phase: ConversationTransferPhase.Prepare,
      }),
    ).toBe(15);
  });

  it('skips a transfer phase that discovered no units', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingleWithAttachments,
        phase: ConversationTransferPhase.Transfer,
        completed: 0,
        total: 0,
      }),
    ).toBe(85);
  });

  it('subdivides the transfer phase evenly across discovered units', () => {
    const percents = [0, 1, 2, 10].map((completed) =>
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingleWithAttachments,
        phase: ConversationTransferPhase.Transfer,
        completed,
        total: 10,
      }),
    );

    expect(percents).toEqual([15, 22, 29, 85]);
  });

  it('a single attachment covers the whole transfer phase', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingleWithAttachments,
        phase: ConversationTransferPhase.Transfer,
        completed: 1,
        total: 1,
      }),
    ).toBe(85);
  });

  it('an attachment-free export has no transfer weight to spend', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingle,
        phase: ConversationTransferPhase.Prepare,
      }),
    ).toBe(20);
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportSingle,
        phase: ConversationTransferPhase.Finalize,
      }),
    ).toBe(100);
  });

  it('splits export-all across listing, per-conversation fetch, and serialization', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportAll,
        phase: ConversationTransferPhase.Prepare,
      }),
    ).toBe(20);
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportAll,
        phase: ConversationTransferPhase.Transfer,
        completed: 2,
        total: 4,
      }),
    ).toBe(55);
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.ExportAll,
        phase: ConversationTransferPhase.Finalize,
      }),
    ).toBe(100);
  });

  it('splits import across parse, upload, and save', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Prepare,
      }),
    ).toBe(10);
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Transfer,
        completed: 4,
        total: 4,
      }),
    ).toBe(80);
    /* 10 prepare + 70 transfer + half of the 20 finalize weight. */
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Finalize,
        completed: 1,
        total: 2,
      }),
    ).toBe(90);
  });

  it('clamps a unit count that overshoots its total', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Finalize,
        completed: 9,
        total: 2,
      }),
    ).toBe(100);
  });

  it('never goes below zero for a negative unit count', () => {
    expect(
      computeTransferPercent({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Prepare,
        completed: -5,
        total: 2,
      }),
    ).toBe(0);
  });

  it('is non-decreasing as units settle one by one', () => {
    let previous = -1;
    for (let completed = 0; completed <= 7; completed += 1) {
      const percent = computeTransferPercent({
        kind: ConversationTransferKind.ExportSingleWithAttachments,
        phase: ConversationTransferPhase.Transfer,
        completed,
        total: 7,
      });
      expect(percent).toBeGreaterThanOrEqual(previous);
      previous = percent;
    }
  });
});

describe('buildTransferProgress', () => {
  it('carries the unit readout when the phase has units', () => {
    expect(
      buildTransferProgress(
        {
          kind: ConversationTransferKind.ExportSingleWithAttachments,
          phase: ConversationTransferPhase.Transfer,
          completed: 3,
          total: 10,
        },
        {
          completed: 3,
          total: 10,
          kind: ConversationTransferUnitKind.Attachment,
        },
      ),
    ).toEqual({
      percent: 36,
      units: {
        completed: 3,
        total: 10,
        kind: ConversationTransferUnitKind.Attachment,
      },
    });
  });

  it('leaves units undefined for an unsubdivided phase', () => {
    expect(
      buildTransferProgress({
        kind: ConversationTransferKind.Import,
        phase: ConversationTransferPhase.Prepare,
      }),
    ).toEqual({ percent: 10, units: undefined });
  });
});
