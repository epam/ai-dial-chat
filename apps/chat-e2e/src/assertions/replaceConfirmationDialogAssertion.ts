import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ReplaceConfirmationDialog } from '@/src/ui/webElements';

export class ReplaceConfirmationDialogAssertion extends BaseAssertion {
  readonly replaceConfirmationDialog: ReplaceConfirmationDialog;

  constructor(replaceConfirmationDialog: ReplaceConfirmationDialog) {
    super();
    this.replaceConfirmationDialog = replaceConfirmationDialog;
  }

  /** Verifies folder visibility state in the dialog */
  public async assertFolderState(
    folderName: string,
    expectedState: ElementState,
  ) {
    const folderLocator =
      this.replaceConfirmationDialog.getFolderByExactName(folderName);
    await super.assertElementState(folderLocator, expectedState);
  }

  /** Verifies conversation visibility state in the dialog */
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

  /** Verifies folder is expanded (arrow has rotate-90 class) */
  public async assertFolderExpanded(folderName: string) {
    const arrowIcon =
      this.replaceConfirmationDialog.getFolderArrowIcon(folderName);

    const classList = await arrowIcon.getAttribute('class');
    this.assertBooleanCondition(
      classList !== null && classList.includes('rotate-90'),
      true,
      ExpectedMessages.folderExpandedInReplaceDialog(folderName),
    );
  }

  /** Verifies folder is collapsed (arrow lacks rotate-90 class) */
  public async assertFolderCollapsed(folderName: string) {
    const arrowIcon =
      this.replaceConfirmationDialog.getFolderArrowIcon(folderName);

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
    const entityIcon =
      this.replaceConfirmationDialog.getConversationIcon(entityName);
    await super.assertEntityIcon(entityIcon, expectedIcon);
  }

  /** Verifies "All items" dropdown displays the expected option */
  public async assertAllItemsOption(expectedOption: string) {
    await super.assertElementText(
      this.replaceConfirmationDialog.getAllItemsDropdown(),
      expectedOption,
      ExpectedMessages.allItemsOptionIsValid(expectedOption),
    );
  }

  /** Verifies conversation dropdown displays the expected option */
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

  /** Verifies conversation has the expected icon */
  public async assertConversationIcon(
    conversationName: string,
    expectedIcon: string,
  ) {
    await this.assertDialogEntityIcon(conversationName, expectedIcon);
  }
}
