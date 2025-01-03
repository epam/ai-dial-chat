import { BaseAssertion } from '@/src/assertions';
import { ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

const translatePropertyRegex = /translate\((\d+)px,\s*(\d+)px\)/;
const propertyNotDefinedError =
  'Translate property is not defined for the element!';

export class OverlayAssertion extends BaseAssertion {
  public async assertOverlayManagerIsVisible(overlayContainer: BaseElement) {
    const styleAttribute = await overlayContainer
      .getElementLocator()
      .getAttribute(Attributes.style);
    const match = styleAttribute?.match(translatePropertyRegex);
    if (match) {
      expect.soft(+match[1], ExpectedMessages.elementIsVisible).toBe(0);
      expect.soft(+match[2], ExpectedMessages.elementIsVisible).toBe(0);
    } else {
      throw new Error(propertyNotDefinedError);
    }
  }

  public async assertOverlayManagerIsHidden(
    overlayContainer: BaseElement,
    viewportSize: { width: number; height: number },
  ) {
    const styleAttribute = await overlayContainer
      .getElementLocator()
      .getAttribute(Attributes.style);
    const translateRegex = /translate\((\d+)px,\s*(\d+)px\)/;
    const match = styleAttribute?.match(translateRegex);
    if (match) {
      expect
        .soft(+match[1], ExpectedMessages.elementIsNotVisible)
        .toBeGreaterThan(viewportSize.width);
      expect
        .soft(+match[2], ExpectedMessages.elementIsNotVisible)
        .toBeGreaterThan(viewportSize.height);
    } else {
      throw new Error(propertyNotDefinedError);
    }
  }
}
