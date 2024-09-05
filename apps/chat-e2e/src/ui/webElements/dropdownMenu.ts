import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { MenuOptions } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';

export class DropdownMenu extends Menu {
  public menuOptions = () =>
    this.getChildElementBySelector(
      `${Tags.div} > *:not([class*=' md:${Attributes.hidden}']) >> ${Tags.span}`,
    );

  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option);

  public getMenuOption(option: string) {
    return this.createElementFromLocator(this.menuOption(option));
  }

  public async selectMenuOption(
    option: string,
    {
      triggeredHttpMethod = undefined,
      isHttpMethodTriggered = true,
    }: {
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE';
      isHttpMethodTriggered?: boolean;
    } = {},
  ) {
    if (isApiStorageType && isHttpMethodTriggered && triggeredHttpMethod) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === triggeredHttpMethod,
      );
      await super.selectMenuOption(option);
      return respPromise;
    }
    await super.selectMenuOption(option);
  }

  public async selectShareMenuOption() {
    const response = await this.selectMenuOption(MenuOptions.share, {
      triggeredHttpMethod: 'POST',
    });
    if (response !== undefined) {
      const responseText = await response.text();
      const request = await response.request().postDataJSON();
      return {
        request: request as ShareRequestModel,
        response: JSON.parse(responseText) as ShareByLinkResponseModel,
      };
    }
  }
}
