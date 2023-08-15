import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/utils/app/const';
import { defaultReplay } from '@/utils/app/defaultStateConstants';

import { Conversation, Message, Replay } from '@/types/chat';
import {
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/types/openai';

import { v4 as uuidv4 } from 'uuid';

export class ConversationBuilder {
  private conversation: Conversation;

  constructor() {
    this.conversation = {
      id: uuidv4(),
      name: DEFAULT_CONVERSATION_NAME,
      messages: [],
      model: OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      folderId: null,
      replay: defaultReplay,
      selectedAddons:
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].selectedAddons ?? [],
      lastActivityDate: Date.now(),
    };
  }

  getConversation() {
    return this.conversation;
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

  withModel(model: OpenAIEntityModel): ConversationBuilder {
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

  withFolderId(folderId: null | string): ConversationBuilder {
    this.conversation.folderId = folderId;
    return this;
  }

  withReplay(replay: Replay): ConversationBuilder {
    this.conversation.replay = replay;
    return this;
  }

  withAddon(addon: string): ConversationBuilder {
    this.conversation.selectedAddons.push(addon);
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
