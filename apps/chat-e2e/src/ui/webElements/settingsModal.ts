import { DialAIEntityModel } from '@/chat/types/models';
import { Tags } from '@/src/ui/domData';
import {
  AccountSettingsModalSelector,
  IconSelectors,
} from '@/src/ui/selectors';
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
    const attributesSelector =
      AccountSettingsModalSelector.startChatWithListboxOptionAttributes;
    const versionSelector =
      AccountSettingsModalSelector.startChatWithListboxOptionVersion;

    return await this.startChatWithListboxOptions
      .getElementLocator()
      .evaluateAll(
        (options, { attributesSelector, versionSelector }) => {
          return options.map((option) => {
            const attributesEl = option.querySelector(attributesSelector);
            const versionEl = option.querySelector(versionSelector);

            const fullText = attributesEl?.textContent ?? '';
            const versionText = versionEl?.textContent ?? '';

            return {
              name: fullText.replace(versionText, '').trim(),
              version: versionText,
            };
          });
        },
        { attributesSelector, versionSelector },
      );
  }
}
