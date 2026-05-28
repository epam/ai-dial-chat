import { BaseAssertion } from '@/src/assertions';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { ToolsetLoginModal } from '@/src/ui/webElements';

export class ToolsetLoginModalAssertion extends BaseAssertion {
  readonly toolsetLoginModal: ToolsetLoginModal;

  constructor(toolsetLoginModal: ToolsetLoginModal) {
    super();
    this.toolsetLoginModal = toolsetLoginModal;
  }

  public async assertModalAttributes(attributesToVerify: {
    expectedName?: string;
    expectedVersion?: string;
    expectedIcon?: string;
    expectedDefaultIconState?: ElementState;
    expectedApiKeyFieldValue?: string;
    expectedLogInBtnState?: ElementActionabilityState;
  }) {
    if (attributesToVerify.expectedName !== undefined) {
      await this.assertElementText(
        this.toolsetLoginModal.toolsetName,
        attributesToVerify.expectedName,
      );
    }
    if (attributesToVerify.expectedVersion !== undefined) {
      await this.assertElementText(
        this.toolsetLoginModal.toolsetVersion,
        `${ExpectedConstants.versionPrefix.concat(attributesToVerify.expectedVersion)}`,
      );
    }
    if (attributesToVerify.expectedDefaultIconState !== undefined) {
      await this.assertElementState(
        this.toolsetLoginModal.toolsetDefaultIcon,
        attributesToVerify.expectedDefaultIconState,
      );
    }
    if (attributesToVerify.expectedIcon !== undefined) {
      await this.assertEntityIcon(
        this.toolsetLoginModal,
        attributesToVerify.expectedIcon,
      );
    }
    if (attributesToVerify.expectedLogInBtnState !== undefined) {
      await this.assertElementActionabilityState(
        this.toolsetLoginModal.loginButton,
        attributesToVerify.expectedLogInBtnState,
      );
    }
    await this.assertElementState(
      this.toolsetLoginModal.apiKeyFieldHelpIcon,
      'visible',
    );
    const fieldRequiredIndicator =
      this.toolsetLoginModal.apiKeyFieldLabel.getFieldRequiredIndicator(
        ExpectedConstants.apiKeyFieldLabel,
      );
    await this.assertElementState(
      fieldRequiredIndicator,
      'visible',
      ExpectedMessages.entityFormFieldShouldHaveAsterisk,
    );
    if (attributesToVerify.expectedApiKeyFieldValue !== undefined) {
      await this.assertElementState(
        this.toolsetLoginModal.apiKeyUnmaskedFieldInput,
        'visible',
      );
      await this.assertElementState(
        this.toolsetLoginModal.apiKeyFieldUnmaskedIcon,
        'visible',
      );
      await this.assertInputValue(
        this.toolsetLoginModal.apiKeyUnmaskedFieldInput,
        attributesToVerify.expectedApiKeyFieldValue,
      );
    } else {
      await this.assertElementState(
        this.toolsetLoginModal.apiKeyMaskedFieldInput,
        'visible',
      );
      await this.assertElementState(
        this.toolsetLoginModal.apiKeyFieldMaskedIcon,
        'visible',
      );
    }
  }
}
