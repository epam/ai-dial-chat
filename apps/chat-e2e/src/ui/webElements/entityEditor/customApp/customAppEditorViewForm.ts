import { ExampleURLs } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { AddEntitySettingsFormSelector } from '@/src/ui/selectors';
import { Combobox, EntityEditorViewForm } from '@/src/ui/webElements';

export const keyEnteringDelay = 30;

export class CustomAppEditorViewForm extends EntityEditorViewForm {
  public chatCompletionUrl = this.getChildElementBySelector(
    AddEntitySettingsFormSelector.chatCompletionUrl,
  );
  public featuresLabel = this.getChildElementBySelector(
    AddEntitySettingsFormSelector.featuresLabel,
  );
  public attachmentsTypesLabel = this.getChildElementBySelector(
    AddEntitySettingsFormSelector.attachmentsTypesLabel,
  );
  public attachmentTypes = new Combobox(this.page, this.rootLocator);

  public featuresDataHintIcon = this.featuresLabel.getChildElementBySelector(
    Tags.svg,
  );
  public attachmentTypesHintIcon =
    this.attachmentsTypesLabel.getChildElementBySelector(Tags.svg);

  public maxAttachmentsInput = this.getChildElementBySelector(
    AddEntitySettingsFormSelector.maxAttachmentNumberField,
  );

  public async fillInAppFields(options?: {
    chatCompletionUrl?: string;
    attachmentTypes?: string[];
    maxAttachments?: string;
  }) {
    if (options?.chatCompletionUrl) {
      await this.chatCompletionUrl.fillInInput(options.chatCompletionUrl);
    } else {
      await this.chatCompletionUrl.fillInInput(ExampleURLs.chatCompletionURL);
    }
    if (options?.attachmentTypes && options.attachmentTypes.length > 0) {
      for (let i = 0; i < options.attachmentTypes.length; i++) {
        const type = options.attachmentTypes[i];
        await this.attachmentTypes.comboboxInput.typeInInput(type, {
          delay: keyEnteringDelay,
        });
        await this.page.keyboard.press(keys.enter);
        await this.attachmentTypes.selectedPills.getNthElement(i + 1).waitFor();
      }
    }
    if (options?.maxAttachments !== undefined) {
      await this.maxAttachmentsInput.typeInInput(options.maxAttachments);
    }
  }
}
