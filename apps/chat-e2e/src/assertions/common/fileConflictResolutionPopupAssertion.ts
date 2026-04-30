import { ConfirmationPopupAssertion } from '@/src/assertions';
import { CheckboxState } from '@/src/testData';
import { FileConflictResolutionPopup } from '@/src/ui/webElements';

export class FileConflictResolutionPopupAssertion extends ConfirmationPopupAssertion {
  private readonly conflictPopup: FileConflictResolutionPopup;

  constructor(popup: FileConflictResolutionPopup) {
    super(popup);
    this.conflictPopup = popup;
  }

  public async assertSingleFileRadioChecked(
    value: 'replace' | 'duplicate',
    expectedState: CheckboxState,
  ) {
    await this.assertCheckboxState(
      this.conflictPopup.getSingleFileRadio(value),
      expectedState,
    );
  }

  public async assertMultipleFilesRadioChecked(
    value: 'replaceAll' | 'duplicateAll' | 'decideForEach',
    expectedState: CheckboxState,
  ) {
    await this.assertCheckboxState(
      this.conflictPopup.getMultipleFilesRadio(value),
      expectedState,
    );
  }
}
