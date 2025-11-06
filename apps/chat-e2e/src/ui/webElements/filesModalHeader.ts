import { FilesModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

const supportedTypesLabel = 'Supported types: ';

export class FilesModalHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FilesModalSelectors.supportedAttributesLabel, parentLocator);
  }

  public async getSupportedTypes() {
    const headerContent = await this.getElementContent();
    const supportedTypesLabelPosition =
      headerContent?.indexOf(supportedTypesLabel);
    return supportedTypesLabelPosition
      ? headerContent
          ?.substring(supportedTypesLabelPosition + supportedTypesLabel.length)
          .trimEnd()
          .replace(/\.$/g, '')
      : undefined;
  }
}
