import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ToggleState } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { EntityEditorPreviewToggle } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';

export class EntityEditorPreviewToggleAssertion extends BaseAssertion {
  private entityEditorPreviewToggle: EntityEditorPreviewToggle;

  constructor(entityEditorPreviewToggle: EntityEditorPreviewToggle) {
    super();
    this.entityEditorPreviewToggle = entityEditorPreviewToggle;
  }

  public async assertToggleState(toggleState: ToggleState) {
    const switcher = this.entityEditorPreviewToggle.detailedSwitch;
    await this.assertElementText(switcher, toggleState);
    const expectedBgColor =
      toggleState === ToggleState.on
        ? ThemeColorAttributes.bgAccentPrimary
        : ThemeColorAttributes.bgLayer4;
    await this.assertElementBackgroundColors(
      switcher,
      ThemesUtil.getRgbColorByKey(expectedBgColor),
    );
  }
}
