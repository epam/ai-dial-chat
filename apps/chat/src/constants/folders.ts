import { translate } from '../utils/app/translation';

import { Translation } from '@/src/types/translation';

export const MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH = 3;

export const PUBLISHING_FOLDER_NAME = translate(
  'promptbar.pernod_ricard_useful_prompts.label',
  { ns: Translation.Folder },
);

export const PUBLISHING_APPROVE_REQUIRED_NAME = translate(
  'promptbar.approve_required.label',
  { ns: Translation.Folder },
);

export const FOLDER_ATTACHMENT_CONTENT_TYPE =
  'application/vnd.dial.metadata+json';
