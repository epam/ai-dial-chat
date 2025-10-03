import { ShareModalAssertion } from '@/src/assertions/shareModalAssertion';
import { CheckboxState, ElementState, ExpectedConstants } from '@/src/testData';
import { ShareAppModal } from '@/src/ui/webElements';

export class ShareAppModalAssertion extends ShareModalAssertion<ShareAppModal> {
  public async assertShareAppInfo(fieldsToVerify: {
    appVersion?: string;
    shareOptionCheckboxState?: CheckboxState;
    shareOptionLabelState?: ElementState;
  }) {
    if (fieldsToVerify.appVersion) {
      await this.assertElementText(
        this.shareModal.appVersion,
        ExpectedConstants.versionPrefix + fieldsToVerify.appVersion,
      );
    }
    if (fieldsToVerify.shareOptionCheckboxState) {
      await this.assertCheckboxState(
        this.shareModal.shareOptionCheckbox,
        fieldsToVerify.shareOptionCheckboxState,
      );
    }
    if (fieldsToVerify.shareOptionLabelState) {
      if (fieldsToVerify.shareOptionLabelState === 'visible') {
        await this.assertElementText(
          this.shareModal.shareOption,
          ExpectedConstants.allowEditingSharedEntityText,
        );
      } else {
        await this.assertElementState(this.shareModal.shareOption, 'hidden');
      }
    }
  }
}
