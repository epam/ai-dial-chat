import { AddExternalAppSettingsFormSelector } from '@/src/ui/selectors';
import { AppEditorViewForm } from '@/src/ui/webElements';

export class ExternalAppEditorViewForm extends AppEditorViewForm {
  public externalUrl = this.getChildElementBySelector(
    AddExternalAppSettingsFormSelector.externalUrl,
  );
}
