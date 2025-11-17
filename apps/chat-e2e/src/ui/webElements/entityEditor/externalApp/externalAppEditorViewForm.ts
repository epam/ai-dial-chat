import { AddExternalAppSettingsFormSelector } from '@/src/ui/selectors';
import { EntityEditorViewForm } from '@/src/ui/webElements';

export class ExternalAppEditorViewForm extends EntityEditorViewForm {
  public externalUrl = this.getChildElementBySelector(
    AddExternalAppSettingsFormSelector.externalUrl,
  );
}
