import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/chat/constants/default-settings';
import { defaultReplay } from '@/chat/constants/replay';
import {
  Conversation,
  ConversationEntityModel,
  Message,
  Replay,
} from '@/chat/types/chat';
import { constructPath } from '@/chat/utils/app/file';
import { getRootId } from '@/chat/utils/app/id';
import { ApiKeys } from '@/chat/utils/server/api';
import { ModelsUtil } from '@/src/utils';
import { v4 as uuidv4 } from 'uuid';

export class ConversationBuilder {
  private conversation: Conversation;

  constructor() {
    this.conversation = {
      id: constructPath(
        getRootId({ apiKey: ApiKeys.Conversations }),
        DEFAULT_CONVERSATION_NAME,
      ),
      name: DEFAULT_CONVERSATION_NAME,
      messages: [],
      model: { id: ModelsUtil.getDefaultModel()!.id },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      replay: defaultReplay,
      selectedAddons: ModelsUtil.getDefaultModel()!.selectedAddons ?? [],
      lastActivityDate: Date.now(),
      isMessageStreaming: false,
      folderId: getRootId({ apiKey: ApiKeys.Conversations }),
    };
  }

  getConversation() {
    return this.conversation;
  }

  setConversation(conversation: Conversation): Conversation {
    this.conversation = conversation;
    return conversation;
  }

  withId(id: string): ConversationBuilder {
    this.conversation.id = id;
    return this;
  }

  withName(name: string): ConversationBuilder {
    this.conversation.name = name;
    return this;
  }

  withMessage(message: Message): ConversationBuilder {
    this.conversation.messages.push(message);
    return this;
  }

  withModel(model: ConversationEntityModel): ConversationBuilder {
    this.conversation.model = model;
    return this;
  }

  withPrompt(prompt: string): ConversationBuilder {
    this.conversation.prompt = prompt;
    return this;
  }

  withTemperature(temperature: number): ConversationBuilder {
    this.conversation.temperature = temperature;
    return this;
  }

  withFolderId(folderId: string): ConversationBuilder {
    this.conversation.folderId = folderId;
    return this;
  }

  withReplay(replay: Replay): ConversationBuilder {
    this.conversation.replay = replay;
    return this;
  }

  withAddons(addons: string[]): ConversationBuilder {
    this.conversation.selectedAddons = addons;
    return this;
  }

  withLastActivityDate(lastActivityDate: number): ConversationBuilder {
    this.conversation.lastActivityDate = lastActivityDate;
    return this;
  }

  build(): Conversation {
    return this.conversation;
  }
}
