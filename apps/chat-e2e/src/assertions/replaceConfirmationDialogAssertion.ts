import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ReplaceConfirmationDialog } from '@/src/ui/webElements';

export class ReplaceConfirmationDialogAssertion extends BaseAssertion {
  readonly replaceConfirmationDialog: ReplaceConfirmationDialog;

  constructor(replaceConfirmationDialog: ReplaceConfirmationDialog) {
    super();
    this.replaceConfirmationDialog = replaceConfirmationDialog;
  }

  /**
   * Asserts that a folder is in the specified state (visible/hidden) in the dialog
   */
  public async assertFolderState(
    folderName: string,
    expectedState: ElementState,
  ) {
    const folderLocator =
      this.replaceConfirmationDialog.getFolderByExactName(folderName);
    await super.assertElementState(folderLocator, expectedState);
  }

  /**
   * Asserts that a conversation is in the specified state (visible/hidden) in the dialog
   */
  public async assertConversationState(
    conversationName: string,
    expectedState: ElementState,
  ) {
    const conversationLocator =
      this.replaceConfirmationDialog.getConversationByExactName(
        conversationName,
      );
    await super.assertElementState(conversationLocator, expectedState);
  }

  /**
   * Asserts that a folder is expanded (arrow icon is rotated)
   * Expanded state is indicated by the arrow icon having the rotate-90 class
   */
  public async assertFolderExpanded(folderName: string) {
    const arrowIcon =
      this.replaceConfirmationDialog.getFolderArrowIcon(folderName);

    // Check if the arrow has the rotate-90 class which indicates expanded state
    const classList = await arrowIcon.getAttribute('class');
    this.assertBooleanCondition(
      classList !== null && classList.includes('rotate-90'),
      true,
      ExpectedMessages.folderExpandedInReplaceDialog(folderName),
    );
  }

  /**
   * Asserts that a folder is collapsed (arrow icon is not rotated)
   * Collapsed state is indicated by the arrow icon NOT having the rotate-90 class
   */
  public async assertFolderCollapsed(folderName: string) {
    const arrowIcon =
      this.replaceConfirmationDialog.getFolderArrowIcon(folderName);

    // Check if the arrow does not have the rotate-90 class which indicates collapsed state
    const classList = await arrowIcon.getAttribute('class');
    this.assertBooleanCondition(
      classList === null || !classList.includes('rotate-90'),
      true,
      ExpectedMessages.folderCollapsed,
    );
  }

  /**
   * Asserts that an entity has the expected icon (renamed to avoid name collision)
   */
  public async assertDialogEntityIcon(
    entityName: string,
    expectedIcon: string,
  ) {
    const entityIcon =
      this.replaceConfirmationDialog.getConversationIcon(entityName);
    await super.assertEntityIcon(entityIcon, expectedIcon);
  }

  /**
   * Asserts that the "All items" dropdown shows the expected option
   */
  public async assertAllItemsOption(expectedOption: string) {
    await super.assertElementText(
      this.replaceConfirmationDialog.getAllItemsDropdown(),
      expectedOption,
      ExpectedMessages.allItemsOptionIsValid(expectedOption),
    );
  }

  /**
   * Asserts that a conversation dropdown shows the expected option
   */
  public async assertConversationOption(
    conversationName: string,
    expectedOption: string,
  ) {
    await super.assertElementText(
      this.replaceConfirmationDialog.getConversationDropdownByName(
        conversationName,
      ),
      expectedOption,
      ExpectedMessages.conversationOptionIsValid(
        conversationName,
        expectedOption,
      ),
    );
  }

  /**
   * Asserts that a conversation has the expected icon
   */
  public async assertConversationIcon(
    conversationName: string,
    expectedIcon: string,
  ) {
    await this.assertDialogEntityIcon(conversationName, expectedIcon);
  }
}
