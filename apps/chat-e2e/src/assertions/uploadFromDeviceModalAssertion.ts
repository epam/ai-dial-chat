import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { UploadFromDeviceModal } from '@/src/ui/webElements';

export class UploadFromDeviceModalAssertion extends BaseAssertion {
  readonly uploadFromDeviceModal: UploadFromDeviceModal;

  constructor(uploadFromDeviceModal: UploadFromDeviceModal) {
    super();
    this.uploadFromDeviceModal = uploadFromDeviceModal;
  }

  public async assertUploadedFilenameInputValue(
    currentFilename: string,
    expectedValue: string,
    expectedMessage?: string,
  ) {
    const filenameInput =
      this.uploadFromDeviceModal.getUploadedFilenameInput(currentFilename);
    await this.assertInputValue(filenameInput, expectedValue, expectedMessage);
  }
}
