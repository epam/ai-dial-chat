import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedConstants } from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { ToolsetEditorViewForm } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';

export class ToolsetEditorViewFormAssertion extends BaseAssertion {
  readonly toolsetEditorViewForm: ToolsetEditorViewForm;

  constructor(toolsetEditorViewForm: ToolsetEditorViewForm) {
    super();
    this.toolsetEditorViewForm = toolsetEditorViewForm;
  }

  public async assertToolsetEditorViewFormAttributes(attributesToVerify: {
    endpoint?: string;
    transportProtocol?: ToolsetTransportType;
    availableAuthTypes?: ToolsetAuthTypes[];
    selectedAuthType?: ToolsetAuthTypes;
    allowedTools?: string[];
  }) {
    await this.assertElementText(
      this.toolsetEditorViewForm.definitionLabel,
      ExpectedConstants.definitionLabel,
    );
    if (attributesToVerify.endpoint !== undefined) {
      await this.assertElementText(
        this.toolsetEditorViewForm.endpointLabel,
        new RegExp(`^${ExpectedConstants.endpointLabel}`, 'g'),
      );
      await this.assertElementAttribute(
        this.toolsetEditorViewForm.endpoint,
        Attributes.placeholder,
        ExpectedConstants.endpointPlaceholder,
      );
      await this.assertInputValue(
        this.toolsetEditorViewForm.endpoint,
        attributesToVerify.endpoint,
      );
    }
    if (attributesToVerify.transportProtocol !== undefined) {
      await this.assertElementText(
        this.toolsetEditorViewForm.protocolLabel,
        new RegExp(`^${ExpectedConstants.transportProtocol}`, 'g'),
      );
      await this.assertElementText(
        this.toolsetEditorViewForm.transportProtocol,
        attributesToVerify.transportProtocol,
      );
    }
    await this.assertElementText(
      this.toolsetEditorViewForm.authenticationLabel,
      ExpectedConstants.authenticationLabel,
    );
    await this.assertElementText(
      this.toolsetEditorViewForm.authenticationLabelSubtitle,
      ExpectedConstants.authenticationLabelSubtitle,
    );
    if (attributesToVerify.availableAuthTypes !== undefined) {
      const authTypeAttributes = {
        [ToolsetAuthTypes.OAUTH]: {
          label: this.toolsetEditorViewForm.oauthLabel,
          expectedLabelText: ExpectedConstants.oAuthLabel,
          icon: this.toolsetEditorViewForm.oauthIcon,
        },
        [ToolsetAuthTypes.API_KEY]: {
          label: this.toolsetEditorViewForm.apiKeyLabel,
          expectedLabelText: ExpectedConstants.apiKeyLabel,
          icon: this.toolsetEditorViewForm.apiKeyIcon,
        },
        [ToolsetAuthTypes.NONE]: {
          label: this.toolsetEditorViewForm.withoutAuthLabel,
          expectedLabelText: ExpectedConstants.withoutAuthLabel,
          icon: this.toolsetEditorViewForm.withoutAuthIcon,
        },
      };
      for (const authType of attributesToVerify.availableAuthTypes) {
        const attributes = authTypeAttributes[authType];
        await this.assertElementText(
          attributes.label,
          attributes.expectedLabelText,
        );
        await this.assertElementState(attributes.icon, 'visible');
      }
    }
    if (attributesToVerify.selectedAuthType !== undefined) {
      const expectedColor = ThemesUtil.getRgbColorByKey(
        ThemeColorAttributes.textAccentPrimary,
      );
      const authTypeAttributes = {
        [ToolsetAuthTypes.OAUTH]: {
          label: this.toolsetEditorViewForm.oauthLabel,
          icon: this.toolsetEditorViewForm.oauthIcon,
          container: this.toolsetEditorViewForm.oauthContainer,
        },
        [ToolsetAuthTypes.API_KEY]: {
          label: this.toolsetEditorViewForm.apiKeyLabel,
          icon: this.toolsetEditorViewForm.apiKeyIcon,
          container: this.toolsetEditorViewForm.apiKeyContainer,
        },
        [ToolsetAuthTypes.NONE]: {
          label: this.toolsetEditorViewForm.withoutAuthLabel,
          icon: this.toolsetEditorViewForm.withoutAuthIcon,
          container: this.toolsetEditorViewForm.withoutAuthContainer,
        },
      };
      const attributes =
        authTypeAttributes[attributesToVerify.selectedAuthType];
      await this.assertElementColor(attributes.label, expectedColor);
      await this.assertElementColor(attributes.icon, expectedColor);
      await this.assertElementActionabilityState(
        attributes.container,
        'disabled',
      );
    }
    if (attributesToVerify.allowedTools !== undefined) {
      await this.assertElementText(
        this.toolsetEditorViewForm.allowedToolsLabel,
        ExpectedConstants.allowedToolsLabel,
      );
      await this.assertElementText(
        this.toolsetEditorViewForm.allowedToolsLabelSubtitle,
        ExpectedConstants.allowedToolsLabelSubtitle,
      );
      const actualAllowedTools =
        await this.toolsetEditorViewForm.allowedTools.getSelectedPillValues();
      this.assertValuesAreEqual(
        actualAllowedTools,
        attributesToVerify.allowedTools,
      );
    }
  }
}
