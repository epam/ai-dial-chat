import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import type { DialFile } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import {
  resolveDialFileApiPath,
  virtualPathToApiPath,
} from '../resolve-dial-file-api-path';

const ROOT_LABEL = 'All files';
const BUCKET = 'user-bucket';

const makeFile = (overrides: Partial<DialFile>): DialFile => ({
  id: 'report.pdf',
  name: 'report.pdf',
  path: '/All files/report.pdf',
  parentPath: '/All files',
  nodeType: DialFileNodeType.ITEM,
  folderId: BUCKET,
  bucket: BUCKET,
  ...overrides,
});

describe('virtualPathToApiPath', () => {
  it('maps the root virtual path to an empty API path', () => {
    expect(virtualPathToApiPath('/All files', ROOT_LABEL)).toBe('');
  });

  it('maps nested folder virtual paths to API folder paths', () => {
    expect(virtualPathToApiPath('/All files/reports/', ROOT_LABEL)).toBe(
      'reports/',
    );
  });
});

describe('resolveDialFileApiPath', () => {
  it('uses DIAL resource ids when they are already bucket-relative', () => {
    expect(
      resolveDialFileApiPath(
        makeFile({ id: 'reports/q1.pdf', path: '/All files/reports/q1.pdf' }),
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
          path: '/All files/reports/q1.pdf',
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
          id: '/All files/reports/q1.pdf',
          path: '/All files/reports/q1.pdf',
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
          path: 'All files/reports/q1.pdf',
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
          path: '/All files/reports/',
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
          id: '/All files/report.pdf',
          path: '/All files/report.pdf',
        }),
        BUCKET,
        ROOT_LABEL,
      ),
    ).toBe('report.pdf');
  });
});
