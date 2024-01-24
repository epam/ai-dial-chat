import {
  Conversation,
  ConversationEntityModel,
  Message,
  Replay,
} from '@/ai-dial-chat/types/chat';

import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/ai-dial-chat/constants/default-settings';
import { defaultReplay } from '@/ai-dial-chat/constants/replay';

import { ModelsUtil } from '@/src/utils';
import { v4 as uuidv4 } from 'uuid';

export class ConversationBuilder {
  private conversation: Conversation;

  constructor() {
    this.conversation = {
      id: uuidv4(),
      name: DEFAULT_CONVERSATION_NAME,
      messages: [],
      model: { id: ModelsUtil.getDefaultModel()!.id },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      replay: defaultReplay,
      selectedAddons: ModelsUtil.getDefaultModel()!.selectedAddons ?? [],
      lastActivityDate: Date.now(),
      isMessageStreaming: false,
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

  withFolderId(folderId: undefined | string): ConversationBuilder {
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
