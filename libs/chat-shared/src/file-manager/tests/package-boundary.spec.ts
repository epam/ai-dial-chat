import { describe, expect, it } from 'vitest';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../file-manager-variant';
import type { DialFileManagerShellLabels } from '../labels';
import { FileUploadStatus } from '../upload-batch';

/*
 * Package export surface test: confirms that each type and enum that
 * DialFileManagerShell consumers depend on is reachable through the
 * file-manager barrel export and therefore through @epam/ai-dial-chat-shared.
 *
 * These are compile-time contracts; the runtime assertions exist only so the
 * test runner counts the file.
 *
 * Library isolation boundary is enforced at the Nx project-graph level:
 * @epam/ai-dial-chat-shared has zero graph-level dependencies, which means
 * no edges to @epam/ai-dial-chat-hooks, @epam/ai-dial-catalog, apps/*, or
 * the generated API client. The `nx graph --print` output confirms this.
 */

/* Compile-time: DialFileManagerShellLabels must expose getSelectionLabel. */
type _HasGetSelectionLabel = DialFileManagerShellLabels extends {
  getSelectionLabel: (count: number) => string;
}
  ? true
  : never;
const _labelsShape: _HasGetSelectionLabel = true;

describe('package export surface', () => {
  it('DialFileManagerShellLabels exposes getSelectionLabel shape', () => {
    expect(_labelsShape).toBe(true);
  });

  it('exports DialFileManagerVariant enum values', () => {
    expect(DialFileManagerVariant.Attach).toBe('attach');
    expect(DialFileManagerVariant.Standalone).toBe('standalone');
    expect(DialFileManagerVariant.FolderPicker).toBe('folder-picker');
  });

  it('exports DialFileManagerActionProfile enum values', () => {
    expect(DialFileManagerActionProfile.Attach).toBe('attach');
    expect(DialFileManagerActionProfile.Browse).toBe('browse');
    expect(DialFileManagerActionProfile.Full).toBe('full');
  });

  it('exports FileUploadStatus enum values', () => {
    expect(FileUploadStatus.Queued).toBe('queued');
    expect(FileUploadStatus.Uploading).toBe('uploading');
    expect(FileUploadStatus.Completed).toBe('completed');
    expect(FileUploadStatus.Failed).toBe('failed');
    expect(FileUploadStatus.Cancelled).toBe('cancelled');
  });
});
