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

  it('rejects a genuinely unknown property', async () => {
    await expect(
      pipe.transform(message({ ...bbox, madeUpField: 'nope' }), {
        type: 'body',
        metatype: ConversationMessageDto,
      }),
    ).rejects.toThrow();
  });

  it('retains a text_character_range selector through validated serialization', async () => {
    const selector = {
      type: 'text_character_range',
      start: 5,
      end: 12,
    };
    const result = await pipe.transform(message(selector), {
      type: 'body',
      metatype: ConversationMessageDto,
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
  });
});

describe('Office citation selector validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
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
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                url: 'files/bucket/report.docx',
              },
            },
          },
        },
      ],
    },
  });

  const transform = (selector: unknown) =>
    pipe.transform(message(selector), {
      type: 'body',
      metatype: ConversationMessageDto,
    });

  it('accepts a DOCX-shaped selector with every field present after validation', async () => {
    const selector = {
      type: 'docx_range',
      story: 'body',
      path: [3, 1],
      start: 0,
      end: 4,
      text: 'Hello',
    };
    const result = await transform(selector);
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
  });

  it('accepts a PPTX-shaped selector with slide and shape_id, surviving serialization and reload', async () => {
    const selector = {
      type: 'pptx_range',
      slide: 1,
      shape_id: '7',
      start: 0,
      end: 4,
      text: 'Hello',
    };
    const result = await transform(selector);
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
  });

  it('accepts an excel_rc_range selector with nested start/end addresses, surviving serialization', async () => {
    const selector = {
      type: 'excel_rc_range',
      sheet: 'Sheet1',
      start: { row: 14, col: 3 },
      end: { row: 14, col: 6 },
    };
    const result = await transform(selector);
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
  });

  it('accepts an excel_rc_range selector with end: null, preserving it as null', async () => {
    const selector = {
      type: 'excel_rc_range',
      sheet: 'Sheet1',
      start: { row: 14, col: 3 },
      end: null,
    };
    const result = await transform(selector);
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(selector));
  });

  it('rejects a non-numeric, non-cell-address start', async () => {
    await expect(
      transform({
        type: 'text_character_range',
        start: 'not-a-number',
        end: 5,
      }),
    ).rejects.toThrow();
  });

  it('rejects a non-numeric, non-cell-address end', async () => {
    await expect(
      transform({
        type: 'text_character_range',
        start: 0,
        end: 'not-a-number',
      }),
    ).rejects.toThrow();
  });

  it('rejects an array as start', async () => {
    await expect(
      transform({ type: 'text_character_range', start: [1, 2], end: 5 }),
    ).rejects.toThrow();
  });

  it('rejects an excel_rc_range start with a non-integer row', async () => {
    await expect(
      transform({
        type: 'excel_rc_range',
        sheet: 'Sheet1',
        start: { row: 'x', col: 3 },
        end: { row: 14, col: 6 },
      }),
    ).rejects.toThrow();
  });

  it('rejects an excel_rc_range start carrying an unknown nested property', async () => {
    await expect(
      transform({
        type: 'excel_rc_range',
        sheet: 'Sheet1',
        start: { row: 14, col: 3, evil: 'payload' },
        end: { row: 14, col: 6 },
      }),
    ).rejects.toThrow();
  });
});
