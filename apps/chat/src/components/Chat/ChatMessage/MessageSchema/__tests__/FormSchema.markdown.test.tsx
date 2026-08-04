import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';

import {
  BOLD_MARKDOWN_SAMPLE,
  expectMarkdownRenderedAsHtml,
} from './markdown-test-helpers';

import {
  DialSchemaProperties,
  FormSchemaPropertyWidget,
  JSONSchemaPropertyType,
  MessageFormSchema,
} from '@epam/ai-dial-shared';

const onChange = vi.fn();

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/src/hooks/useResizeObserver', () => ({
  useResizeObserver: vi.fn(),
}));

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector) => selector()),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/src/store/selectors', () => ({
  ConversationsSelectors: {
    selectSelectedConversations: vi.fn(() => [{ messages: [{ id: '1' }] }]),
    selectIsPlaybackSelectedConversations: vi.fn(() => false),
    selectAction: vi.fn(() => null),
  },
  SettingsSelectors: {
    selectAllowedImageSources: vi.fn(() => ''),
  },
}));

const buttonPropertySchema = {
  type: JSONSchemaPropertyType.string,
  [DialSchemaProperties.DialWidget]: FormSchemaPropertyWidget.buttons,
  oneOf: [
    {
      title: 'Alex P.',
      const: 'alex-id',
      description: '**option bold** option plain',
      [DialSchemaProperties.DialWidgetOptions]: { submit: true },
    },
  ],
};

describe('FormSchema markdown descriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders property-level description markdown', () => {
    const schema: MessageFormSchema = {
      type: 'object',
      properties: {
        persona_selection: {
          ...buttonPropertySchema,
          description: BOLD_MARKDOWN_SAMPLE,
        },
      },
    };

    render(<FormSchema schema={schema} onChange={onChange} formValue={{}} />);

    expectMarkdownRenderedAsHtml({
      boldText: 'bolded text',
      plainText: 'not bolded text',
      rawMarkdown: BOLD_MARKDOWN_SAMPLE,
    });
  });

  it('renders oneOf option description markdown below buttons', () => {
    const schema: MessageFormSchema = {
      type: 'object',
      properties: {
        persona_selection: {
          ...buttonPropertySchema,
          oneOf: [
            {
              title: 'Alex P.',
              const: 'alex-id',
              description: '**option bold** option plain',
              [DialSchemaProperties.DialWidgetOptions]: { submit: true },
            },
          ],
        },
      },
    };

    render(<FormSchema schema={schema} onChange={onChange} formValue={{}} />);

    expect(screen.getByRole('button', { name: 'Alex P.' })).toBeInTheDocument();

    expectMarkdownRenderedAsHtml({
      boldText: 'option bold',
      plainText: 'option plain',
      rawMarkdown: '**option bold** option plain',
    });
  });
});
