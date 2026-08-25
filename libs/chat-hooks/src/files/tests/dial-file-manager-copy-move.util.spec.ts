import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { DialCopiedItem } from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import {
  prepareCopyItems,
  prepareMoveRenameItems,
} from '../dial-file-manager-copy-move.util';

const ROOT_LABEL = 'My files';
const BUCKET = 'user-bucket';

const makeItem = (overrides: Partial<DialCopiedItem>): DialCopiedItem => ({
  sourceUrl: '/My files/report.pdf',
  destinationUrl: '/My files/reports/report.pdf',
  nodeType: DialFileNodeType.ITEM,
  ...overrides,
});

describe('prepareCopyItems', () => {
  it('builds a copyFiles DTO for a file item with normalized paths', () => {
    const [prepared] = prepareCopyItems([makeItem({})], BUCKET, ROOT_LABEL);

    expect(prepared.dto).toEqual({
      bucket: BUCKET,
      sourcePath: 'report.pdf',
      destinationPath: 'reports/report.pdf',
      overwrite: false,
      nodeType: 'item',
      name: 'report.pdf',
    });
    expect(prepared.destinationName).toBe('report.pdf');
  });

  it('trailing-slashes folder paths', () => {
    const [prepared] = prepareCopyItems(
      [
        makeItem({
          sourceUrl: '/My files/reports',
          destinationUrl: '/My files/archive/reports',
          nodeType: DialFileNodeType.FOLDER,
        }),
      ],
      BUCKET,
      ROOT_LABEL,
    );

    expect(prepared.dto.sourcePath).toBe('reports/');
    expect(prepared.dto.destinationPath).toBe('archive/reports/');
    expect(prepared.dto.nodeType).toBe('folder');
  });

  it('propagates the overwrite flag', () => {
    const [prepared] = prepareCopyItems(
      [makeItem({ overwrite: true })],
      BUCKET,
      ROOT_LABEL,
    );
    expect(prepared.dto.overwrite).toBe(true);
  });
});

describe('prepareMoveRenameItems', () => {
  it('classifies a same-parent item as a rename', () => {
    const { renameDtos, preparedMoveItems } = prepareMoveRenameItems(
      [
        makeItem({
          sourceUrl: '/My files/report.pdf',
          destinationUrl: '/My files/report-renamed.pdf',
        }),
      ],
      BUCKET,
      ROOT_LABEL,
    );

    expect(preparedMoveItems).toHaveLength(0);
    expect(renameDtos).toEqual([
      {
        bucket: BUCKET,
        sourcePath: 'report.pdf',
        destinationPath: 'report-renamed.pdf',
        nodeType: 'item',
        name: 'report.pdf',
      },
    ]);
  });

  it('classifies a different-parent item as a move', () => {
    const { renameDtos, preparedMoveItems } = prepareMoveRenameItems(
      [
        makeItem({
          sourceUrl: '/My files/report.pdf',
          destinationUrl: '/My files/reports/report.pdf',
        }),
      ],
      BUCKET,
      ROOT_LABEL,
    );

    expect(renameDtos).toHaveLength(0);
    expect(preparedMoveItems).toHaveLength(1);
    expect(preparedMoveItems[0].dto).toEqual({
      bucket: BUCKET,
      sourcePath: 'report.pdf',
      destinationPath: 'reports/report.pdf',
      overwrite: false,
      nodeType: 'item',
      name: 'report.pdf',
    });
    expect(preparedMoveItems[0].destinationName).toBe('report.pdf');
  });

  it('splits a mixed batch into rename and move buckets', () => {
    const { renameDtos, preparedMoveItems } = prepareMoveRenameItems(
      [
        makeItem({
          sourceUrl: '/My files/a.pdf',
          destinationUrl: '/My files/a-renamed.pdf',
        }),
        makeItem({
          sourceUrl: '/My files/b.pdf',
          destinationUrl: '/My files/reports/b.pdf',
        }),
      ],
      BUCKET,
      ROOT_LABEL,
    );

    expect(renameDtos).toHaveLength(1);
    expect(preparedMoveItems).toHaveLength(1);
  });
});
