import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { API, MenuOptions } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';
import { Response } from 'playwright-core';

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
      apiHost = undefined,
    }: {
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
      isHttpMethodTriggered?: boolean;
      apiHost?: string;
    } = {},
  ) {
    if (isApiStorageType && isHttpMethodTriggered && triggeredHttpMethod) {
      const predicate = (resp: Response) =>
        apiHost !== undefined
          ? resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200 &&
            resp.url().includes(apiHost)
          : resp.request().method() === triggeredHttpMethod &&
            resp.status() === 200;
      const respPromise = this.page.waitForResponse(predicate);
      await super.selectMenuOption(option);
      return respPromise;
    }
    await super.selectMenuOption(option);
  }

  public async selectShareMenuOption() {
    const response = await this.selectMenuOption(MenuOptions.share, {
      isHttpMethodTriggered: true,
      triggeredHttpMethod: 'POST',
      apiHost: API.shareEntityHost,
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
