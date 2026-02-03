import { combineEpics } from 'redux-observable';

import { ApplicationEpics } from './application/application.epics';
import { ApplicationTypesSchemasEpics } from './applicationTypeSchemas/applicationTypeSchemas.epics';
import { ChatEpics } from './chat/chat.epics';
import { CodeEditorEpics } from './codeEditor/codeEditor.epics';
import { ConversationsEpics } from './conversations/conversations.epics';
import { FilesEpics } from './files/files.epics';
import { ImportExportEpics } from './import-export/importExport.epics';
import { MarketplaceEpics } from './marketplace/marketplace.epics';
import { MigrationEpics } from './migration/migration.epics';
import { ModelsEpics } from './models/models.epics';
import { OverlayEpics } from './overlay/overlay.epics';
import { PromptsEpics } from './prompts/prompts.epics';
import { PublicationEpics } from './publication/publication.epics';
import { ServiceEpics } from './service/service.epics';
import { SettingsEpics } from './settings/settings.epics';
import { ShareEpics } from './share/share.epics';
import { ToolsetEpics } from './toolset/toolset.epics';
import { UIEpics } from './ui/ui.epics';

export const rootEpic = combineEpics(
  ModelsEpics,
  UIEpics,
  ShareEpics,
  PromptsEpics,
  ConversationsEpics,
  OverlayEpics,
  SettingsEpics,
  FilesEpics,
  ImportExportEpics,
  ServiceEpics,
  MigrationEpics,
  PublicationEpics,
  ApplicationEpics,
  CodeEditorEpics,
  ApplicationTypesSchemasEpics,
  ChatEpics,
  MarketplaceEpics,
  ToolsetEpics,
);
