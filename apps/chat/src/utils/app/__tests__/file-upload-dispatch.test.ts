import { describe, expect, it, vi } from 'vitest';

import { dispatchRetryFileUpload } from '@/src/utils/app/file-upload-dispatch';

import { FilesActions } from '@/src/store/actions';

describe('dispatchRetryFileUpload', () => {
  it('dispatches reuploadFile with the given fileId', () => {
    const dispatch = vi.fn();

    dispatchRetryFileUpload(dispatch, 'files/bucket/image.png');

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(
      FilesActions.reuploadFile({ fileId: 'files/bucket/image.png' }),
    );
  });
});
