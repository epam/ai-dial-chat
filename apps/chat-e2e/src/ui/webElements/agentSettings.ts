import { ChatSettingsModalSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Addons } from '@/src/ui/webElements/addons';
import { PROMPT_APPLY_DELAY } from '@/src/ui/webElements/chat';
import { PromptList } from '@/src/ui/webElements/promptList';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { Locator, Page } from '@playwright/test';

export class AgentSettings extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsModalSelectors.entitySettings, parentLocator);
  }

  public systemPrompt = this.getChildElementBySelector(
    ChatSettingsModalSelectors.systemPrompt,
  );
  private temperatureSlider!: TemperatureSlider;
  private addons!: Addons;
  private promptList!: PromptList;

  getPromptList() {
    if (!this.promptList) {
      this.promptList = new PromptList(this.page, this.rootLocator);
    }
    return this.promptList;
  }

  getTemperatureSlider(): TemperatureSlider {
    if (!this.temperatureSlider) {
      this.temperatureSlider = new TemperatureSlider(
        this.page,
        this.rootLocator,
      );
    }
    return this.temperatureSlider;
  }

  getAddons(): Addons {
    if (!this.addons) {
      this.addons = new Addons(this.page, this.rootLocator);
    }
    return this.addons;
  }

  public async setSystemPrompt(prompt: string) {
    await this.systemPrompt.typeInInput(prompt);
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(PROMPT_APPLY_DELAY);
  }

  public async clearAndSetSystemPrompt(prompt: string) {
    await this.clearSystemPrompt();
    await this.setSystemPrompt(prompt);
  }

  public async getSystemPrompt() {
    return this.systemPrompt.getElementContent();
  }

  public async clearSystemPrompt() {
    return this.systemPrompt.fillInInput('');
  }
}
