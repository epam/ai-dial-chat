import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import {
  resolveDialFileApiPath,
  virtualPathToApiPath,
} from '../resolve-dial-file-api-path';

const ROOT_LABEL = 'My files';
const BUCKET = 'user-bucket';

const makeFile = (overrides: Partial<DialFile>): DialFile => ({
  id: 'report.pdf',
  name: 'report.pdf',
  path: '/My files/report.pdf',
  parentPath: '/My files',
  nodeType: DialFileNodeType.ITEM,
  folderId: BUCKET,
  bucket: BUCKET,
  ...overrides,
});

describe('virtualPathToApiPath', () => {
  it.each([
    [
      'maps the root virtual path to an empty API path',
      { path: '/My files', expected: '' },
    ],
    [
      'maps nested folder virtual paths to API folder paths',
      { path: '/My files/reports/', expected: 'reports/' },
    ],
    [
      'collapses double slashes from a folder-prefix + leading-slash paste destination',
      {
        path: '/My files/folder_for_test//file.png',
        expected: 'folder_for_test/file.png/',
      },
    ],
  ])('%s', (_name, { path, expected }) => {
    expect(virtualPathToApiPath(path, ROOT_LABEL)).toBe(expected);
  });
});

describe('resolveDialFileApiPath', () => {
  it('uses DIAL resource ids when they are already bucket-relative', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({ id: 'reports/q1.pdf', path: '/My files/reports/q1.pdf' }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('reports/q1.pdf');
  });

  it('strips files/{bucket}/ prefixes from resource ids', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({
          id: `files/${BUCKET}/reports/q1.pdf`,
          path: '/My files/reports/q1.pdf',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('reports/q1.pdf');
  });

  it('converts virtual file paths when the resource id is also virtual', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({
          id: '/My files/reports/q1.pdf',
          path: '/My files/reports/q1.pdf',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('reports/q1.pdf');
  });

  it('converts virtual paths without a leading slash', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({
          id: undefined,
          path: 'My files/reports/q1.pdf',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('reports/q1.pdf');
  });

  it('keeps trailing slashes for folders and removes them for files', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({
          id: 'reports/',
          path: '/My files/reports/',
          nodeType: DialFileNodeType.FOLDER,
          name: 'reports',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('reports/');

    expect(
      resolveDialFileApiPath(
        makeFile({
          id: '/My files/report.pdf',
          path: '/My files/report.pdf',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('report.pdf');
  });
});
