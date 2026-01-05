import { BaseAssertion } from '@/src/assertions';
import { ExpectedMessages } from '@/src/testData';
import { ConfirmationPopup } from '@/src/ui/webElements';

export class ConfirmationPopupAssertion extends BaseAssertion {
  private readonly confirmationPopup: ConfirmationPopup;

  constructor(confirmationPopup: ConfirmationPopup) {
    super();
    this.confirmationPopup = confirmationPopup;
  }

  public async assertConfirmationPopupHeader(expectedHeader: string) {
    await this.assertElementText(
      this.confirmationPopup.header,
      expectedHeader,
      ExpectedMessages.popupHeaderIsValid,
    );
  }

  public async assertConfirmationPopupContent(expectedContent: string) {
    await this.assertElementText(
      this.confirmationPopup.content,
      expectedContent,
      ExpectedMessages.popupContentIsValid,
    );
  }
}
