import { describe, expect, it } from 'vitest';
import {
  FILE_TRANSFER_STRATEGIES,
  getTransferErrorMessage,
} from '../../batch/file-transfer-strategy';
import { FileTransferKind } from '../../types/file-transfer-kind.enum';

describe('FILE_TRANSFER_STRATEGIES', () => {
  it('renames through moveResource without ever overwriting or guarding nesting', () => {
    expect(FILE_TRANSFER_STRATEGIES[FileTransferKind.Rename]).toEqual({
      sdkOperation: 'moveResource',
      operationTag: 'files.renameItem',
      batchLabel: 'Rename',
      logName: 'rename',
      failedError: 'Rename failed',
      partialError: 'Partial rename',
      honorsOverwrite: false,
      rejectsNestedDestination: false,
    });
  });

  it('copies through copyResource, honoring overwrite and allowing nested destinations', () => {
    expect(FILE_TRANSFER_STRATEGIES[FileTransferKind.Copy]).toEqual({
      sdkOperation: 'copyResource',
      operationTag: 'files.copyItem',
      batchLabel: 'Copy',
      logName: 'copy',
      failedError: 'Copy failed',
      partialError: 'Partial copy',
      honorsOverwrite: true,
      rejectsNestedDestination: false,
    });
  });

  it('moves through moveResource, honoring overwrite and rejecting nested destinations', () => {
    expect(FILE_TRANSFER_STRATEGIES[FileTransferKind.Move]).toEqual({
      sdkOperation: 'moveResource',
      operationTag: 'files.moveItem',
      batchLabel: 'Move',
      logName: 'move',
      failedError: 'Move failed',
      partialError: 'Partial move',
      honorsOverwrite: true,
      rejectsNestedDestination: true,
    });
  });
});

describe('getTransferErrorMessage', () => {
  const copy = FILE_TRANSFER_STRATEGIES[FileTransferKind.Copy];

  it.each([
    [409, 'Conflict'],
    [403, 'Forbidden'],
    [404, 'Not found'],
  ])('maps a %i response to %s', (status, expected) => {
    expect(getTransferErrorMessage(copy, {}, { status })).toBe(expected);
  });

  it.each(Object.values(FileTransferKind))(
    "falls back to the %s strategy's failed message for any other status",
    (kind) => {
      const strategy = FILE_TRANSFER_STRATEGIES[kind];

      expect(getTransferErrorMessage(strategy, {}, { status: 400 })).toBe(
        strategy.failedError,
      );
    },
  );

  it('falls back to the failed message for a thrown non-HTTP error', () => {
    expect(getTransferErrorMessage(copy, new Error('boom'))).toBe(
      'Copy failed',
    );
  });
});
