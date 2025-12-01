import {
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorPreviewCard,
  EntityEditorPreviewToggle,
} from '@/src/ui/webElements';

export class EntityEditorEntitySettingsCardPreviewBody extends EntityEditorEntitySettingsPreviewBody {
  private entityEditorPreviewToggle!: EntityEditorPreviewToggle;
  private entityEditorPreviewCard!: EntityEditorPreviewCard;

  public getEntityEditorPreviewToggle() {
    if (!this.entityEditorPreviewToggle) {
      this.entityEditorPreviewToggle = new EntityEditorPreviewToggle(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorPreviewToggle;
  }

  public getEntityEditorPreviewCard() {
    if (!this.entityEditorPreviewCard) {
      this.entityEditorPreviewCard = new EntityEditorPreviewCard(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorPreviewCard;
  }
}
