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

describe('mapStages — nested stage snapshots', () => {
  it('gives an unindexed snapshot positional indexes and keeps a three-level hierarchy', () => {
    expect(
      mapStages([
        { name: 'Plan', status: 'completed' },
        { name: 'Search', status: 'completed', parent_stage_index: 0 },
        { name: 'Read', parent_stage_index: 1 },
      ]),
    ).toEqual([
      { index: 0, name: 'Plan', status: StageStatus.Completed },
      {
        index: 1,
        name: 'Search',
        status: StageStatus.Completed,
        parent_stage_index: 0,
      },
      { index: 2, name: 'Read', status: null, parent_stage_index: 1 },
    ]);
  });

  it('keeps explicit sparse indexes instead of array positions', () => {
    expect(
      mapStages([
        { index: 4, name: 'Plan' },
        { index: 9, name: 'Search', parent_stage_index: 4 },
      ]),
    ).toEqual([
      { index: 4, name: 'Plan', status: null },
      { index: 9, name: 'Search', status: null, parent_stage_index: 4 },
    ]);
  });

  it('keeps a parent of zero', () => {
    expect(
      mapStages([
        { index: 0, name: 'Plan' },
        { index: 1, name: 'Search', parent_stage_index: 0 },
      ])?.[1].parent_stage_index,
    ).toBe(0);
  });

  it.each([undefined, null])(
    'omits the parent field for a %p parent — a top-level stage',
    (parent) => {
      const [stage] = mapStages([
        { name: 'Plan', parent_stage_index: parent },
      ])!;
      expect('parent_stage_index' in stage).toBe(false);
    },
  );

  it.each([
    [
      'custom_content',
      {
        custom_content: {
          stages: [{ name: 'Plan' }, { name: 'Search', parent_stage_index: 0 }],
        },
      },
    ],
    [
      'customContent',
      {
        customContent: {
          stages: [{ name: 'Plan' }, { name: 'Search', parent_stage_index: 0 }],
        },
      },
    ],
  ])('normalizes a nested snapshot carried in %s', (_form, source) => {
    expect(mapStages(source)).toEqual([
      { index: 0, name: 'Plan', status: null },
      { index: 1, name: 'Search', status: null, parent_stage_index: 0 },
    ]);
  });

  it('keeps attachments and status defaults unchanged for nested stages', () => {
    expect(
      mapStages([
        { name: 'Plan', status: 'running' },
        {
          name: 'Search',
          status: 'failed',
          parent_stage_index: 0,
          attachments: [{ index: 0, url: 'files/a.pdf' }],
        },
      ]),
    ).toEqual([
      { index: 0, name: 'Plan', status: null },
      {
        index: 1,
        name: 'Search',
        status: StageStatus.Failed,
        parent_stage_index: 0,
        attachments: [{ index: 0, title: '', url: 'files/a.pdf' }],
      },
    ]);
  });

  it('does not mutate its input', () => {
    const input: RawStage[] = [
      { name: 'Plan' },
      { name: 'Search', parent_stage_index: 0 },
    ];
    const snapshot = structuredClone(input);

    mapStages(input);

    expect(input).toEqual(snapshot);
  });

  it('keeps toStage single-item defaults for an unindexed entry', () => {
    expect(toStage({ name: 'Search', parent_stage_index: 0 })).toEqual({
      index: 0,
      name: 'Search',
      status: null,
      parent_stage_index: 0,
    });
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
