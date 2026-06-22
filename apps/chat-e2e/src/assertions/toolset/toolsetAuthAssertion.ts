import { ToolsetAuthPayloadBase } from '@/chat/types/toolsets';
import { BaseAssertion } from '@/src/assertions';
import { Creds, SignInButtonTitles } from '@/src/testData';
import { ToolsetOAuthSignInRequest } from '@/src/testData/toolsets/authMockConfig';
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
    request: ToolsetOAuthSignInRequest | ToolsetAuthPayloadBase,
    expectedId: string,
    expectedCredsLabel: Creds,
    expectedSignInButtonTitle: SignInButtonTitles,
  ) {
    this.assertValue(request.url, decodeURIComponent(expectedId));
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
