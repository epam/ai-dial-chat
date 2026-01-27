import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { UploadFromDeviceModal } from '@/src/ui/webElements';

export class UploadFromDeviceModalAssertion extends BaseAssertion {
  readonly uploadFromDeviceModal: UploadFromDeviceModal;

  constructor(uploadFromDeviceModal: UploadFromDeviceModal) {
    super();
    this.uploadFromDeviceModal = uploadFromDeviceModal;
  }
}
