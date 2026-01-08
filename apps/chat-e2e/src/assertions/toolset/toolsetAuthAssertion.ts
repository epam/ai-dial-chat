import { ToolsetAuthPayloadBase } from '@/chat/types/toolsets';
import { BaseAssertion } from '@/src/assertions';
import { Creds, SignInButtonTitles } from '@/src/testData';
import { ToolsetSignInRequest } from '@/src/testData/toolsets/oauthMockConfig';
import {
  EntityEditorPreviewCard,
  ToolsetEditorViewForm,
} from '@/src/ui/webElements';

export class ToolsetAuthAssertion extends BaseAssertion {
  readonly entityEditorPreviewCard: EntityEditorPreviewCard;
  readonly toolsetEditorViewForm: ToolsetEditorViewForm;

  constructor(
    entityEditorPreviewCard: EntityEditorPreviewCard,
    toolsetEditorViewForm: ToolsetEditorViewForm,
  ) {
    super();
    this.entityEditorPreviewCard = entityEditorPreviewCard;
    this.toolsetEditorViewForm = toolsetEditorViewForm;
  }

  public async assertAuthState(
    request: ToolsetSignInRequest | ToolsetAuthPayloadBase,
    expectedId: string,
    expectedCredsLabel: Creds,
    expectedSignInButtonTitle: SignInButtonTitles,
  ) {
    this.assertValue(request.url, expectedId);
    await this.assertElementText(
      this.entityEditorPreviewCard.credsLabel,
      expectedCredsLabel,
    );
    await this.assertElementText(
      expectedSignInButtonTitle === 'Log in'
        ? this.toolsetEditorViewForm.loginButton
        : this.toolsetEditorViewForm.logoutButton,
      expectedSignInButtonTitle,
    );
  }
}
