import { FilesActions } from '@/src/store/actions';

import type { AppDispatch } from '@/src/store';

export function dispatchRetryFileUpload(
  dispatch: AppDispatch,
  fileId: string,
): void {
  dispatch(FilesActions.reuploadFile({ fileId }));
}
