import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

describe('PDF citation message validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const bbox = { type: 'pdf_bbox', page: 3, x1: 0, y1: 0, x2: 0, y2: 0 };
  const message = (selector: unknown) => ({
    role: ConversationMessageRole.Assistant,
    content: '<cit data-id="page-3"></cit>',
    timestamp: '2026-09-09T07:00:00Z',
    custom_content: {
      annotations: [
        {
          index: 0,
          target: { selector: { type: 'html_tag', tag: 'cit', id: 'page-3' } },
          body: {
            selector,
            source: {
              type: 'attachment',
              attachment: {
                type: 'application/pdf',
                url: 'files/bucket/report.pdf',
              },
            },
          },
        },
      ],
    },
  });

  it.each([false, true])(
    'retains a PDF body selector through validated message serialization (array: %s)',
    async (asArray) => {
      const selector = asArray ? [bbox] : bbox;
      const result = await pipe.transform(message(selector), {
        type: 'body',
        metatype: ConversationMessageDto,
      });
      expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
    },
  );

  it('rejects a wrong type in a nested page field', async () => {
    await expect(
      pipe.transform(message({ ...bbox, page: '3' }), {
        type: 'body',
        metatype: ConversationMessageDto,
      }),
    ).rejects.toThrow();
  });
});
