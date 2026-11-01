import { HttpException, HttpStatus } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import type { DialFileNodeType } from '../dto/dial-file-node-type';
import { FileTransferKind } from '../types/file-transfer-kind.enum';

/** Request fields every rename/copy/move item DTO shares. */
export interface TransferItem {
  bucket: string;
  sourcePath: string;
  destinationPath: string;
  nodeType: DialFileNodeType;
  overwrite?: boolean;
}

/** Result fields every rename/copy/move item result DTO shares. */
export interface TransferItemResult {
  sourcePath: string;
  destinationPath: string;
  success: boolean;
  error?: string;
}

/* `copyResource` and `moveResource` take the same request and answer shape. */
export type TransferCall = (init: {
  headers: Record<string, string>;
  body: { sourceUrl: string; destinationUrl: string; overwrite: boolean };
  signal: AbortSignal;
}) => Promise<{ error?: unknown; response: { status: number } }>;

/** Everything that differs between the rename, copy and move transfer pipelines. */
export interface FileTransferStrategy {
  /** DIAL Core SDK operation that performs one file transfer. */
  sdkOperation: 'moveResource' | 'copyResource';
  /** `handleDialSdkError` operation tag. */
  operationTag: string;
  /** Batch log prefix, e.g. "Rename" → "Rename files started". */
  batchLabel: string;
  /** Per-item log name, e.g. "rename" → "renameFileItem failed". */
  logName: string;
  /** Per-item `error` when no specific status applies. */
  failedError: string;
  /** Folder `error` when some children failed. */
  partialError: string;
  /** False for rename: the request DTO has no `overwrite`, and DIAL Core always gets `false`. */
  honorsOverwrite: boolean;
  /** True for move: a destination at or inside the source folder is rejected. */
  rejectsNestedDestination: boolean;
}

export const FILE_TRANSFER_STRATEGIES: Record<
  FileTransferKind,
  FileTransferStrategy
> = {
  [FileTransferKind.Rename]: {
    sdkOperation: 'moveResource',
    operationTag: 'files.renameItem',
    batchLabel: 'Rename',
    logName: 'rename',
    failedError: 'Rename failed',
    partialError: 'Partial rename',
    honorsOverwrite: false,
    rejectsNestedDestination: false,
  },
  [FileTransferKind.Copy]: {
    sdkOperation: 'copyResource',
    operationTag: 'files.copyItem',
    batchLabel: 'Copy',
    logName: 'copy',
    failedError: 'Copy failed',
    partialError: 'Partial copy',
    honorsOverwrite: true,
    rejectsNestedDestination: false,
  },
  [FileTransferKind.Move]: {
    sdkOperation: 'moveResource',
    operationTag: 'files.moveItem',
    batchLabel: 'Move',
    logName: 'move',
    failedError: 'Move failed',
    partialError: 'Partial move',
    honorsOverwrite: true,
    rejectsNestedDestination: true,
  },
};

const getResourceOperationErrorMessage = (
  error: unknown,
  operationTag: string,
  fallback: string,
  response?: { status: number },
): string => {
  try {
    handleDialSdkError(error, operationTag, undefined, response);
  } catch (err) {
    if (err instanceof HttpException) {
      if (err.getStatus() === HttpStatus.CONFLICT) return 'Conflict';
      if (err.getStatus() === HttpStatus.FORBIDDEN) return 'Forbidden';
      if (err.getStatus() === HttpStatus.NOT_FOUND) return 'Not found';
    }
  }

  return fallback;
};

/** Per-item `error` string for a failed transfer of the given kind. */
export const getTransferErrorMessage = (
  strategy: FileTransferStrategy,
  error: unknown,
  response?: { status: number },
): string =>
  getResourceOperationErrorMessage(
    error,
    strategy.operationTag,
    strategy.failedError,
    response,
  );
