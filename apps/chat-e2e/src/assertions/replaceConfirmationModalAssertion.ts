import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
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
    const conversationDropdown = this.replaceConfirmationModal
      .getConversations()
      .getConversationDropdownByName(conversationName);

    await super.assertElementText(
      conversationDropdown,
      expectedOption,
      ExpectedMessages.conversationOptionIsValid(
        conversationName,
        expectedOption,
      ),
    );
  }

  public async assertFolderConversationOption(
    conversationName: string,
    folderName: string,
    expectedOption: string,
  ) {
    const folderConversationDropdown = this.replaceConfirmationModal
      .getFolders()
      .getConversationDropdownByName(folderName, conversationName);

    await super.assertElementText(
      folderConversationDropdown,
      expectedOption,
      ExpectedMessages.conversationOptionIsValid(
        conversationName,
        expectedOption,
      ),
    );
  }
}
