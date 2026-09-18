import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
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
});
