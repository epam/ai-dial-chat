import { beforeEach, describe, it, vi } from 'vitest';

import { render } from '@testing-library/react';

import { UserSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/UserSchema';

import {
  BOLD_MARKDOWN_SAMPLE,
  expectMarkdownRenderedAsHtml,
} from './markdown-test-helpers';

import {
  DialSchemaProperties,
  FormSchemaPropertyWidget,
  JSONSchemaPropertyType,
  Message,
  MessageFormSchema,
} from '@epam/ai-dial-shared';

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const configurationSchema: MessageFormSchema = {
  type: 'object',
  properties: {
    persona_selection: {
      type: JSONSchemaPropertyType.string,
      description: BOLD_MARKDOWN_SAMPLE,
      [DialSchemaProperties.DialWidget]: FormSchemaPropertyWidget.buttons,
      oneOf: [
        {
          title: 'Alex P.',
          const: 'alex-id',
          description: '**user message bold** user message plain',
          [DialSchemaProperties.DialWidgetOptions]: {
            submit: true,
            showDescriptionInUserMessage: true,
          },
        },
      ],
    },
  },
};

const allMessages = [
  {
    custom_content: {
      configuration_schema: configurationSchema,
    },
  },
] as Message[];

describe('UserSchema markdown descriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders property-level description markdown as HTML in read-only user messages', () => {
    render(
      <UserSchema
        messageIndex={0}
        allMessages={allMessages}
        isEditing={false}
        formValue={{ persona_selection: 'alex-id' }}
      />,
    );

    expectMarkdownRenderedAsHtml({
      boldText: 'bolded text',
      plainText: 'not bolded text',
      rawMarkdown: BOLD_MARKDOWN_SAMPLE,
    });
  });

  it('renders option description markdown as HTML when showDescriptionInUserMessage is true', () => {
    render(
      <UserSchema
        messageIndex={0}
        allMessages={allMessages}
        isEditing={false}
        formValue={{ persona_selection: 'alex-id' }}
      />,
    );

    expectMarkdownRenderedAsHtml({
      boldText: 'user message bold',
      plainText: 'user message plain',
      rawMarkdown: '**user message bold** user message plain',
    });
  });
});
