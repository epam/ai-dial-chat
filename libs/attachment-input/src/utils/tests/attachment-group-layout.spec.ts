import { describe, expect, it } from 'vitest';
import { AttachmentTilesLayout } from '../../models/attachment-group';
import { getAttachmentTilesPlan } from '../attachment';

describe('getAttachmentTilesPlan', () => {
  it('returns None for zero attachments', () => {
    expect(getAttachmentTilesPlan(0, false)).toEqual({
      layout: AttachmentTilesLayout.None,
      visibleCount: 0,
      hiddenCount: 0,
    });
  });

  it.each([1, 2, 3, 4])(
    'shows all %i attachments below the collapse threshold',
    (count) => {
      expect(getAttachmentTilesPlan(count, false)).toEqual({
        layout: AttachmentTilesLayout.AllVisible,
        visibleCount: count,
        hiddenCount: 0,
      });
    },
  );

  it('collapses 5+ attachments behind a +N tile by default', () => {
    expect(getAttachmentTilesPlan(13, false)).toEqual({
      layout: AttachmentTilesLayout.Collapsed,
      visibleCount: 4,
      hiddenCount: 9,
    });
  });

  it('shows every attachment once expanded', () => {
    expect(getAttachmentTilesPlan(13, true)).toEqual({
      layout: AttachmentTilesLayout.AllVisible,
      visibleCount: 13,
      hiddenCount: 0,
    });
  });

  it('treats exactly 5 attachments as the collapse boundary', () => {
    expect(getAttachmentTilesPlan(5, false).layout).toBe(
      AttachmentTilesLayout.Collapsed,
    );
    expect(getAttachmentTilesPlan(4, false).layout).toBe(
      AttachmentTilesLayout.AllVisible,
    );
  });
});
