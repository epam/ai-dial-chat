import type { ApplicationEditorDefinition } from '../../../models/application-editor';
import { ApplicationEditorKind } from '../../../types/application-editor';
import { customAppDefinition } from './customAppDefinition';
import { toolsetDefinition } from './toolsetDefinition';

/** Every application kind `ApplicationEditorPage` can render. Adding a kind means adding its definition here. */
export const APPLICATION_EDITOR_DEFINITIONS: Partial<
  Record<ApplicationEditorKind, ApplicationEditorDefinition>
> = {
  [ApplicationEditorKind.Toolset]: toolsetDefinition,
  [ApplicationEditorKind.CustomApp]: customAppDefinition,
};
