import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { Toast } from '@/src/ui/webElements';

export class ToastAssertion extends BaseAssertion {
  readonly toast: Toast;

  constructor(toast: Toast) {
    super();
    this.toast = toast;
  }

  public async assertToastIsVisible() {
    await this.assertElementState(
      this.toast,
      'visible',
      ExpectedMessages.errorToastIsShown,
    );
  }

  public async assertToastIsHidden() {
    await this.assertElementState(
      this.toast,
      'hidden',
      ExpectedMessages.noErrorToastIsShown,
    );
  }

  public async assertToastMessage(
    expectedMessage: string | RegExp,
    messageType?: string,
  ) {
    await this.assertElementText(this.toast, expectedMessage, messageType);
  }
}
