import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ConversationMessageDto } from './conversation-message.dto';
import { StageDto, StageStatusDto } from './stage.dto';

const makeDto = (overrides: Record<string, unknown> = {}): StageDto =>
  plainToInstance(StageDto, { index: 0, name: 'Lookup', ...overrides });

const errorsFor = async (dto: StageDto): Promise<string[]> =>
  (await validate(dto)).map((error) => error.property);

const isValid = async (dto: StageDto): Promise<boolean> =>
  (await errorsFor(dto)).length === 0;

describe('StageDto', () => {
  describe('status', () => {
    it.each([StageStatusDto.Completed, StageStatusDto.Failed])(
      'accepts the terminal state %s',
      async (status) => {
        expect(await isValid(makeDto({ status }))).toBe(true);
      },
    );

    it('accepts null — the stage is still running', async () => {
      expect(await isValid(makeDto({ status: null }))).toBe(true);
    });

    it('accepts an omitted status', async () => {
      expect(await isValid(makeDto())).toBe(true);
    });

    it.each(['running', 'COMPLETED', 'done', ''])(
      'rejects the unknown state %p',
      async (status) => {
        expect(await errorsFor(makeDto({ status }))).toContain('status');
      },
    );
  });

  describe('tag', () => {
    it('accepts a source/category label', async () => {
      expect(await isValid(makeDto({ tag: 'MCP' }))).toBe(true);
    });

    it('rejects a non-string tag', async () => {
      expect(await errorsFor(makeDto({ tag: 42 }))).toContain('tag');
    });
  });

  describe('name', () => {
    it("accepts null — DIAL Core's stage-opened signal", async () => {
      expect(await isValid(makeDto({ name: null }))).toBe(true);
    });

    it('rejects a non-string name', async () => {
      expect(await errorsFor(makeDto({ name: 7 }))).toContain('name');
    });
  });

  describe('attachments', () => {
    it('accepts a nested attachment', async () => {
      const dto = makeDto({
        attachments: [{ index: 0, title: 'report.pdf', data: 'AA' }],
      });
      expect(await isValid(dto)).toBe(true);
    });

    it('rejects a nested attachment with an invalid field', async () => {
      const dto = makeDto({ attachments: [{ index: 'first' }] });
      expect(await errorsFor(dto)).toContain('attachments');
    });
  });

  describe('parent_stage_index', () => {
    it.each([0, 1, 42])('accepts the parent index %p', async (parent) => {
      expect(await isValid(makeDto({ parent_stage_index: parent }))).toBe(true);
    });

    it('accepts an omitted parent — a top-level stage', async () => {
      expect(await isValid(makeDto())).toBe(true);
    });

    it.each([-1, 0.5, '0', 'parent'])(
      'rejects the invalid parent index %p',
      async (parent) => {
        expect(
          await errorsFor(makeDto({ parent_stage_index: parent })),
        ).toContain('parent_stage_index');
      },
    );

    /* Mirrors the global pipe options set in `main.ts`. */
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const nestedMessage = (parent: unknown) => ({
      role: 'assistant',
      content: 'Result',
      timestamp: '2026-09-30T10:00:00.000Z',
      custom_content: {
        stages: [
          { index: 0, name: 'Plan', status: 'completed' },
          { index: 1, parent_stage_index: parent, name: 'Search' },
        ],
      },
    });

    it('keeps a nested zero parent through the transforming validation pipe', async () => {
      const message = (await pipe.transform(nestedMessage(0), {
        type: 'body',
        metatype: ConversationMessageDto,
      })) as ConversationMessageDto;

      expect(message.custom_content?.stages?.[1]).toBeInstanceOf(StageDto);
      expect(
        instanceToPlain(message).custom_content.stages[1].parent_stage_index,
      ).toBe(0);
    });

    it('rejects a nested negative parent through the validation pipe', async () => {
      await expect(
        pipe.transform(nestedMessage(-1), {
          type: 'body',
          metatype: ConversationMessageDto,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
