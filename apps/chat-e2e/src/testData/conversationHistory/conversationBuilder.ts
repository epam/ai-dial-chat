import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/chat/constants/default-ui-settings';
import { defaultReplay } from '@/chat/constants/replay';
import { Conversation, Replay } from '@/chat/types/chat';
import { ItemUtil, ModelsUtil } from '@/src/utils';
import { ConversationEntityModel, Message } from '@epam/ai-dial-shared';

export class ConversationBuilder {
  private conversation: Conversation;

  constructor() {
    const model = ModelsUtil.getDefaultModel()!;
    this.conversation = {
      id: `${model.id}${ItemUtil.conversationIdSeparator}${DEFAULT_CONVERSATION_NAME}`,
      name: DEFAULT_CONVERSATION_NAME,
      messages: [],
      model: { id: model.id },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      replay: defaultReplay,
      selectedAddons: model.selectedAddons ?? [],
      lastActivityDate: Date.now(),
      folderId: '',
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
