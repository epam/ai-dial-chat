import { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import { ToolsetEditorQuery } from '../../../constants/toolsets';
import type { ApplicationEditorPageDefinition } from '../../../models/application-editor';
import { ApplicationEditorKind } from '../../../types/application-editor';
import ToolsetApplicationEditor from '../toolset/ToolsetApplicationEditor';

/* The toolset's post-save login and OAuth flow live in its own library container, so it renders its own page body. */
export const toolsetDefinition: ApplicationEditorPageDefinition = {
  kind: ApplicationEditorKind.Toolset,
  creationType: CatalogCreationType.Toolset,
  idQueryParam: ToolsetEditorQuery.Id,
  renderPage: () => <ToolsetApplicationEditor />,
};
