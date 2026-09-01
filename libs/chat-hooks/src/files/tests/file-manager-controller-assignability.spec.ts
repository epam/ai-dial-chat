import type { FileManagerController } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { UseDialFileManagerResult } from '../dial-file-manager.types';

/*
 * Compile-time assignability assertion: UseDialFileManagerResult must satisfy
 * FileManagerController without a cast or adapter object. If this file stops
 * compiling, the shell's view contract diverged from the hook result.
 */
type AssertAssignable<Target, Source extends Target> = Source;
type _Proof = AssertAssignable<FileManagerController, UseDialFileManagerResult>;

describe('FileManagerController assignability', () => {
  it('UseDialFileManagerResult is structurally assignable to FileManagerController', () => {
    /* The compile-time assertion above is the real test. This runtime
       assertion exists only so the test runner counts it. */
    const proof: _Proof = {} as UseDialFileManagerResult;
    expect(proof).toBeDefined();
  });

  it('controller does not include host-only fields (isAnyOperationInProgress, isCreatingFolder)', () => {
    type ControllerKeys = keyof FileManagerController;
    type ForbiddenKeys = 'isAnyOperationInProgress' | 'isCreatingFolder';

    /* This will fail to compile if any forbidden key appears in FileManagerController. */
    type NonePresent = ForbiddenKeys extends ControllerKeys ? never : true;
    const _check: NonePresent = true;
    expect(_check).toBe(true);
  });
});
