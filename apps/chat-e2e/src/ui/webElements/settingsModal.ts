import { DialAIEntityModel } from '@/chat/types/models';
import { Tags } from '@/src/ui/domData';
import { IconSelectors } from '@/src/ui/selectors';
import { AccountSettingsModalSelector } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class SettingsModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, AccountSettingsModalSelector.settingsModal, parentLocator);
  }

  private themeDropdownMenu!: DropdownButtonMenu;

  getThemeDropdownMenu(): DropdownButtonMenu {
    if (!this.themeDropdownMenu) {
      this.themeDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.themeDropdownMenu;
  }

  public theme = this.getChildElementBySelector(
    AccountSettingsModalSelector.theme,
  );
  public customLogo = this.getChildElementBySelector(
    AccountSettingsModalSelector.customLogo,
  );

  public fullWidthChatToggle = this.getChildElementBySelector(
    AccountSettingsModalSelector.fullWidthChatToggle,
  );

  public saveButton = this.getChildElementBySelector(
    AccountSettingsModalSelector.save,
  );
  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
  public fullWidthChatToggleLabel =
    this.fullWidthChatToggle.getChildElementBySelector(Tags.label);
  public startChatWith = this.getChildElementBySelector(
    AccountSettingsModalSelector.startChatWith,
  );
  public startChatWithSelectedAgent =
    this.startChatWith.getChildElementBySelector(
      AccountSettingsModalSelector.startChatWithSelectedOption,
    );
  public startChatWithAgentAttributes =
    this.startChatWithSelectedAgent.getChildElementBySelector(
      AccountSettingsModalSelector.startChatWithListboxOptionAttributes,
    );
  public startChatWithAgentIcon = this.getElementIcon(
    this.startChatWithSelectedAgent.getElementLocator(),
  );
  public startChatWithToggle = this.startChatWith.getChildElementBySelector(
    AccountSettingsModalSelector.startChatWithToggle,
  );
  public startChatWithSearchInput =
    this.startChatWith.getChildElementBySelector(
      AccountSettingsModalSelector.startChatWithSearchInput,
    );
  public startChatWithListbox = this.startChatWith.getChildElementBySelector(
    AccountSettingsModalSelector.startChatWithListbox,
  );
  public noAvailableItems = this.startChatWithListbox.getChildElementBySelector(
    AccountSettingsModalSelector.noAvailableItems,
  );
  public startChatWithListboxOptions =
    this.startChatWithListbox.getChildElementBySelector(
      AccountSettingsModalSelector.startChatWithListboxOption,
    );
  public startChatWithListboxOptionAttributes =
    this.startChatWithListboxOptions.getChildElementBySelector(
      AccountSettingsModalSelector.startChatWithListboxOptionAttributes,
    );
  public optionAttributes = (
    agent: DialAIEntityModel | { name: string; version?: string } | string,
  ) =>
    typeof agent === 'string'
      ? agent
      : agent.version
        ? `${agent.name}${agent.version}`
        : agent.name;

  public startChatWithListboxAgent = (
    agent: DialAIEntityModel | { name: string; version?: string } | string,
  ) => {
    const agentAttributes = new BaseElement(
      this.page,
      AccountSettingsModalSelector.startChatWithListboxOptionAttributes,
    )
      .getElementLocator()
      .filter({
        hasText: new RegExp(
          `^${RegexUtil.escapeRegexChars(this.optionAttributes(agent))}$`,
        ),
      });
    return this.startChatWithListboxOptions.getElementLocator().filter({
      has: agentAttributes,
    });
  };

  public startChatWithListboxAgentAttributes = (
    agent: DialAIEntityModel | { name: string; version?: string } | string,
  ) =>
    this.startChatWithListboxAgent(agent).locator(
      AccountSettingsModalSelector.startChatWithListboxOptionAttributes,
    );

  public startChatWithListboxAgentIcon = (
    agent: DialAIEntityModel | { name: string; version?: string } | string,
  ) => this.getElementIcon(this.startChatWithListboxAgent(agent));

  public async getAllOptions() {
    const allOptionsAttributes: { name: string; version: string }[] = [];
    const optionsCount =
      await this.startChatWithListboxOptions.getElementsCount();
    for (let i = 1; i <= optionsCount; i++) {
      const optionAttributesElement =
        this.startChatWithListboxOptionAttributes.getNthElement(i);
      const optionVersionElement = optionAttributesElement.locator(
        AccountSettingsModalSelector.startChatWithListboxOptionVersion,
      );
      const optionAttributes = await optionAttributesElement.textContent();
      const optionVersion = (await optionVersionElement.isVisible())
        ? await optionVersionElement.textContent()
        : '';
      allOptionsAttributes.push({
        name: optionAttributes!.replaceAll(optionVersion!, ''),
        version: optionVersion!,
      });
    }
    return allOptionsAttributes;
  }
}
