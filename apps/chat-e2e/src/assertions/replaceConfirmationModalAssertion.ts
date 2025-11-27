import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ReplaceConfirmationModal } from '@/src/ui/webElements';

export class ReplaceConfirmationModalAssertion extends BaseAssertion {
  readonly replaceConfirmationModal: ReplaceConfirmationModal;

  constructor(replaceConfirmationModal: ReplaceConfirmationModal) {
    super();
    this.replaceConfirmationModal = replaceConfirmationModal;
  }

  /** Verifies folder visibility state in the dialog */
  public async assertFolderState(
    folderName: string,
    expectedState: ElementState,
  ) {
    const folderLocator = this.replaceConfirmationModal
      .getFolders()
      .getFolderByExactName(folderName);
    await super.assertElementState(folderLocator, expectedState);
  }

  /** Verifies conversation visibility state in the dialog */
  public async assertConversationState(
    conversationName: string,
    expectedState: ElementState,
  ) {
    const conversationLocator = this.replaceConfirmationModal
      .getConversations()
      .getEntityByExactName(conversationName);
    await super.assertElementState(conversationLocator, expectedState);
  }

  /** Verifies folder is expanded (arrow has rotate-90 class) */
  public async assertFolderExpanded(folderName: string) {
    const arrowIcon = this.replaceConfirmationModal
      .getFolders()
      .getFolderExpandIcon(folderName);

    const classList = await arrowIcon.getAttribute('class');
    this.assertBooleanCondition(
      classList !== null && classList.includes('rotate-90'),
      true,
      ExpectedMessages.folderExpandedInReplaceDialog(folderName),
    );
  }

  /** Verifies folder is collapsed (arrow lacks rotate-90 class) */
  public async assertFolderCollapsed(folderName: string) {
    const arrowIcon = this.replaceConfirmationModal
      .getFolders()
      .getFolderExpandIcon(folderName);

    const classList = await arrowIcon.getAttribute('class');
    this.assertBooleanCondition(
      classList === null || !classList.includes('rotate-90'),
      true,
      ExpectedMessages.folderCollapsed,
    );
  }

  /** Verifies conversation icon matches expected icon */
  public async assertDialogEntityIcon(
    entityName: string,
    expectedIcon: string,
  ) {
    const entityIcon = this.replaceConfirmationModal
      .getConversations()
      .getEntityIcon(entityName);
    await super.assertEntityIcon(entityIcon, expectedIcon);
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

  /** Verifies conversation has the expected icon */
  public async assertConversationIcon(
    conversationName: string,
    expectedIcon: string,
  ) {
    await this.assertDialogEntityIcon(conversationName, expectedIcon);
  }
}
