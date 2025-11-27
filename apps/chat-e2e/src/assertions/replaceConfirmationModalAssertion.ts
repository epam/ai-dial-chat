import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ReplaceConfirmationModal } from '@/src/ui/webElements';

export class ReplaceConfirmationModalAssertion extends BaseAssertion {
  readonly replaceConfirmationModal: ReplaceConfirmationModal;

  constructor(replaceConfirmationModal: ReplaceConfirmationModal) {
    super();
    this.replaceConfirmationModal = replaceConfirmationModal;
  }

  /** Verifies "All items" dropdown displays the expected option */
  public async assertAllItemsOption(expectedOption: string) {
    await super.assertElementText(
      this.replaceConfirmationModal.getAllItemsDropdown(),
      expectedOption,
      ExpectedMessages.allItemsOptionIsValid(expectedOption),
    );
  }

  /** Verifies conversation dropdown displays the expected option */
  public async assertConversationOption(
    conversationName: string,
    expectedOption: string,
  ) {
    const rootDropdown = this.replaceConfirmationModal
      .getConversations()
      .getConversationDropdownByName(conversationName);
    const folderDropdown = this.replaceConfirmationModal
      .getFolders()
      .getConversationDropdownByName(conversationName);

    await super.assertElementText(
      rootDropdown.or(folderDropdown),
      expectedOption,
      ExpectedMessages.conversationOptionIsValid(
        conversationName,
        expectedOption,
      ),
    );
  }
}
