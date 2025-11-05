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
      for (const authType of attributesToVerify.availableAuthTypes) {
        switch (authType) {
          case ToolsetAuthTypes.OAUTH:
            await this.assertElementText(
              this.toolsetEditorViewForm.oauthLabel,
              ExpectedConstants.oAuthLabel,
            );
            await this.assertElementState(
              this.toolsetEditorViewForm.oauthIcon,
              'visible',
            );
            break;
          case ToolsetAuthTypes.API_KEY:
            await this.assertElementText(
              this.toolsetEditorViewForm.apiKeyLabel,
              ExpectedConstants.apiKeyLabel,
            );
            await this.assertElementState(
              this.toolsetEditorViewForm.apiKeyIcon,
              'visible',
            );
            break;
          case ToolsetAuthTypes.NONE:
            await this.assertElementText(
              this.toolsetEditorViewForm.withoutAuthLabel,
              ExpectedConstants.withoutAuthLabel,
            );
            await this.assertElementState(
              this.toolsetEditorViewForm.withoutAuthIcon,
              'visible',
            );
            break;
        }
      }
    }
    if (attributesToVerify.selectedAuthType !== undefined) {
      const expectedColor = ThemesUtil.getRgbColorByKey(
        ThemeColorAttributes.textAccentPrimary,
      );
      switch (attributesToVerify.selectedAuthType) {
        case ToolsetAuthTypes.OAUTH:
          await this.assertElementColor(
            this.toolsetEditorViewForm.oauthLabel,
            expectedColor,
          );
          await this.assertElementColor(
            this.toolsetEditorViewForm.oauthIcon,
            expectedColor,
          );
          await this.assertElementActionabilityState(
            this.toolsetEditorViewForm.oauthContainer,
            'disabled',
          );
          break;
        case ToolsetAuthTypes.API_KEY:
          await this.assertElementColor(
            this.toolsetEditorViewForm.apiKeyLabel,
            expectedColor,
          );
          await this.assertElementColor(
            this.toolsetEditorViewForm.apiKeyIcon,
            expectedColor,
          );
          await this.assertElementActionabilityState(
            this.toolsetEditorViewForm.apiKeyContainer,
            'disabled',
          );
          break;
        case ToolsetAuthTypes.NONE:
          await this.assertElementColor(
            this.toolsetEditorViewForm.withoutAuthLabel,
            expectedColor,
          );
          await this.assertElementColor(
            this.toolsetEditorViewForm.withoutAuthIcon,
            expectedColor,
          );
          await this.assertElementActionabilityState(
            this.toolsetEditorViewForm.withoutAuthContainer,
            'disabled',
          );
          break;
      }
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
