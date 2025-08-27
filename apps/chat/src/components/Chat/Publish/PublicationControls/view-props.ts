import { CustomApplicationModel } from '@/src/types/applications';
import { PromptInfo } from '@/src/types/prompt';

import { ConversationInfo } from '@epam/ai-dial-shared';

export type TEntity = PromptInfo | ConversationInfo | CustomApplicationModel;
