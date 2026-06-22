import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { Cursors } from '@/src/ui/domData';
import { EntityEditorGeneralForm } from '@/src/ui/webElements';

export class EntityEditorGeneralFormAssertion extends BaseAssertion {
  readonly entityEditorGeneralForm: EntityEditorGeneralForm;

  constructor(entityEditorGeneralForm: EntityEditorGeneralForm) {
    super();
    this.entityEditorGeneralForm = entityEditorGeneralForm;
  }

  public async assertFormIsReadOnly() {
    const controls = [
      this.entityEditorGeneralForm.name,
      this.entityEditorGeneralForm.version,
      this.entityEditorGeneralForm.changeIcon,
      this.entityEditorGeneralForm.description,
      this.entityEditorGeneralForm.topicsDropdownContainer,
    ];
    for (const control of controls) {
      await this.assertElementCursor(control, Cursors.notAllowed);
    }
  }
}
