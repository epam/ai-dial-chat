import type { ApplicationEditorDefinition } from '../../../models/application-editor';
import { ApplicationEditorKind } from '../../../types/application-editor';
import { customAppDefinition } from './customAppDefinition';
import { quickAppDefinition } from './quickAppDefinition';
import { toolsetDefinition } from './toolsetDefinition';

/** Every application kind `ApplicationEditorPage` can render. Adding a kind means adding its definition here. */
export const APPLICATION_EDITOR_DEFINITIONS: Record<
  ApplicationEditorKind,
  ApplicationEditorDefinition
> = {
  [ApplicationEditorKind.Toolset]: toolsetDefinition,
  [ApplicationEditorKind.CustomApp]: customAppDefinition,
  [ApplicationEditorKind.QuickApp]: quickAppDefinition,
};
