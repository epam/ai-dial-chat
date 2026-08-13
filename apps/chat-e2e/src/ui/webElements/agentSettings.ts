import {
  ChatSelectors,
  ChatSettingsModalSelectors,
  IconSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { PROMPT_APPLY_DELAY } from '@/src/ui/webElements/chat';
import { PromptList } from '@/src/ui/webElements/promptList';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { ConversationResponseFormat } from '@epam/ai-dial-shared';
import { Locator, Page } from '@playwright/test';

export class AgentSettings extends BaseElement {
  constructor(page: Page, parentLocator: Locator, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSettingsModalSelectors.entitySettings,
      parentLocator,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public systemPromptContainer = this.getChildElementBySelector(
    ChatSettingsModalSelectors.systemPromptContainer,
  );
  public systemPrompt = this.systemPromptContainer.getChildElementBySelector(
    ChatSettingsModalSelectors.systemPrompt,
  );
  public systemPromptSpinner =
    this.systemPromptContainer.getChildElementBySelector(
      ChatSelectors.entitySpinner,
    );

  public responseFormatContainer = this.getChildElementBySelector(
    ChatSettingsModalSelectors.responseFormatContainer,
  );
  public responseFormatHelpIcon =
    this.responseFormatContainer.getChildElementBySelector(
      IconSelectors.helpIcon,
    );

  private temperatureSlider!: TemperatureSlider;
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

  public async setSystemPrompt(prompt: string) {
    await this.systemPrompt.typeInInput(prompt);
    await this.page.waitForTimeout(PROMPT_APPLY_DELAY);
  }

  public async clearAndSetSystemPrompt(prompt: string) {
    await this.clearSystemPrompt();
    await this.setSystemPrompt(prompt);
  }

  public async clearSystemPrompt() {
    return this.systemPrompt.fillInInput('');
  }

  public getResponseFormatRadioButton(format: ConversationResponseFormat) {
    return this.responseFormatContainer
      .getElementLocator()
      .getByRole('radio', { name: format });
  }

  public async setResponseFormat(format: ConversationResponseFormat) {
    await this.getResponseFormatRadioButton(format).click();
  }
}
