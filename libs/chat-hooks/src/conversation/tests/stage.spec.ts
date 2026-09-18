import { StageDtoStatusEnum } from '@epam/ai-dial-chat-api-client';
import type { StageDto } from '@epam/ai-dial-chat-api-client';
import { StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { RawStage } from '../stage';
import { mapStages, toStage } from '../stage';

describe('toStage', () => {
  it('normalizes a settled stage', () => {
    expect(
      toStage({ index: 2, name: 'Lookup', status: 'completed', tag: 'MCP' }),
    ).toEqual({
      index: 2,
      name: 'Lookup',
      status: StageStatus.Completed,
      tag: 'MCP',
    });
  });

  it('maps a failed status', () => {
    expect(toStage({ index: 0, name: 'Lookup', status: 'failed' }).status).toBe(
      StageStatus.Failed,
    );
  });

  it.each([undefined, null, 'running', 'COMPLETED', ''])(
    'treats the status %p as still running',
    (status) => {
      expect(toStage({ index: 0, name: 'Lookup', status }).status).toBeNull();
    },
  );

  it('defaults a missing index to 0 and a null name to an empty string', () => {
    expect(toStage({ name: null })).toEqual({
      index: 0,
      name: '',
      status: null,
    });
  });

  it('passes content through and omits absent optional fields', () => {
    const stage = toStage({ index: 0, name: 'Lookup', content: 'partial' });
    expect(stage.content).toBe('partial');
    expect('tag' in stage).toBe(false);
    expect('attachments' in stage).toBe(false);
  });

  it('normalizes attachments, defaulting a missing title', () => {
    const stage = toStage({
      index: 0,
      name: 'Lookup',
      attachments: [
        { index: 0, title: 'report.pdf', data: 'AA' },
        { index: 1, reference_url: 'https://example.com/a.pdf' },
      ],
    });
    expect(stage.attachments).toEqual([
      { index: 0, title: 'report.pdf', data: 'AA' },
      { index: 1, title: '', reference_url: 'https://example.com/a.pdf' },
    ]);
  });
});

describe('mapStages', () => {
  it.each([undefined, null, []])('returns undefined for %p', (source) => {
    expect(mapStages(source)).toBeUndefined();
  });

  it('returns undefined when neither custom content carries stages', () => {
    expect(mapStages({})).toBeUndefined();
    expect(mapStages({ custom_content: { stages: [] } })).toBeUndefined();
    expect(mapStages({ custom_content: null })).toBeUndefined();
  });

  it('maps a raw stage array', () => {
    expect(
      mapStages([{ index: 0, name: 'Lookup', status: 'completed' }]),
    ).toEqual([{ index: 0, name: 'Lookup', status: StageStatus.Completed }]);
  });

  it('reads snake_case custom_content', () => {
    expect(
      mapStages({ custom_content: { stages: [{ index: 1, name: 'A' }] } }),
    ).toEqual([{ index: 1, name: 'A', status: null }]);
  });

  it('falls back to camelCase customContent', () => {
    expect(
      mapStages({ customContent: { stages: [{ index: 1, name: 'A' }] } }),
    ).toEqual([{ index: 1, name: 'A', status: null }]);
  });

  it('prefers snake_case when a payload carries both', () => {
    expect(
      mapStages({
        custom_content: { stages: [{ index: 0, name: 'wire' }] },
        customContent: { stages: [{ index: 0, name: 'host' }] },
      }),
    ).toEqual([{ index: 0, name: 'wire', status: null }]);
  });
});

/*
 * Compile-time assignability assertion: the generated `StageDto` must satisfy
 * `RawStage` without a cast, so a REST-loaded conversation maps straight
 * through `mapStages`. If this stops compiling, the DTO and the mapper's
 * input contract diverged.
 */
type AssertAssignable<Target, Source extends Target> = Source;
type _DtoProof = AssertAssignable<RawStage, StageDto>;

describe('RawStage / StageDto', () => {
  it('accepts a generated StageDto as mapper input', () => {
    const dto: StageDto = {
      index: 0,
      name: 'Lookup',
      status: StageDtoStatusEnum.Failed,
      tag: 'MCP',
      attachments: [{ index: 0, title: 'report.pdf' }],
    };
    const proof: _DtoProof = dto;

    expect(mapStages([proof])).toEqual([
      {
        index: 0,
        name: 'Lookup',
        status: StageStatus.Failed,
        tag: 'MCP',
        attachments: [{ index: 0, title: 'report.pdf' }],
      },
    ]);
  });
});
