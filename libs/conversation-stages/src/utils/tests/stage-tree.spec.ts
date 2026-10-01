import type { Stage } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { StageNode } from '../../models/stage-tree';
import {
  buildStageTree,
  getGroupExpansionKey,
  getStageExpansionKey,
} from '../stage-tree';

const stage = (index: number, parent?: number, name = `S${index}`): Stage => ({
  index,
  name,
  status: null,
  ...(parent !== undefined && { parent_stage_index: parent }),
});

/* Compact `index(children…)` form for readable hierarchy assertions. */
const shape = (nodes: StageNode[]): string =>
  nodes
    .map((node) =>
      node.children.length
        ? `${node.stage.index}(${shape(node.children)})`
        : `${node.stage.index}`,
    )
    .join(' ');

const flatten = (nodes: StageNode[]): Stage[] =>
  nodes.flatMap((node) => [node.stage, ...flatten(node.children)]);

describe('buildStageTree', () => {
  it('returns an empty forest for no stages', () => {
    expect(buildStageTree([])).toEqual([]);
  });

  it('keeps a flat legacy array as roots in input order', () => {
    expect(shape(buildStageTree([stage(0), stage(1), stage(2)]))).toBe('0 1 2');
  });

  it('attaches a child to parent zero', () => {
    expect(shape(buildStageTree([stage(0), stage(1, 0)]))).toBe('0(1)');
  });

  it('builds multiple roots and three levels', () => {
    expect(
      shape(buildStageTree([stage(0), stage(1, 0), stage(2, 1), stage(3)])),
    ).toBe('0(1(2)) 3');
  });

  it('keeps interleaved siblings under their own parents in encounter order', () => {
    expect(
      shape(
        buildStageTree([
          stage(0),
          stage(1),
          stage(2, 0),
          stage(3, 1),
          stage(4, 0),
          stage(5, 1),
        ]),
      ),
    ).toBe('0(2 4) 1(3 5)');
  });

  it('resolves sparse parents by index rather than array position', () => {
    expect(shape(buildStageTree([stage(4), stage(7, 4), stage(9, 4)]))).toBe(
      '4(7 9)',
    );
  });

  it.each([
    ['a missing parent', [stage(0), stage(3, 1)]],
    ['a self reference', [stage(0), stage(2, 2)]],
    ['a forward reference', [stage(0, 1), stage(1)]],
    ['a negative parent', [stage(0), stage(1, -1)]],
    ['a fractional parent', [stage(0), stage(1, 0.5)]],
    [
      'a non-numeric parent',
      [stage(0), { ...stage(1), parent_stage_index: '0' as unknown as number }],
    ],
  ])('renders a stage with %s at the root', (_case, stages) => {
    const roots = buildStageTree(stages);
    expect(roots).toHaveLength(2);
    expect(roots.every((node) => node.children.length === 0)).toBe(true);
  });

  it('breaks a two-stage cycle at its forward edge, keeping every stage once', () => {
    const roots = buildStageTree([stage(0, 1), stage(1, 0)]);
    expect(shape(roots)).toBe('0(1)');
    expect(flatten(roots)).toHaveLength(2);
  });

  it('places a child under a parent that arrives in a later complete snapshot', () => {
    const child = stage(2, 0);
    expect(shape(buildStageTree([child]))).toBe('2');
    expect(shape(buildStageTree([stage(0), child]))).toBe('0(2)');
    expect(child.parent_stage_index).toBe(0);
  });

  it('does not mutate its input and references the original stages', () => {
    const input = [stage(0), stage(1, 0)];
    const snapshot = structuredClone(input);

    const roots = buildStageTree(input);

    expect(input).toEqual(snapshot);
    expect(roots[0].stage).toBe(input[0]);
    expect(roots[0].children[0].stage).toBe(input[1]);
    expect('children' in input[0]).toBe(false);
  });

  it('keeps every stage exactly once in a many-level chain', () => {
    const depth = 500;
    const input = Array.from({ length: depth }, (_, index) =>
      stage(index, index === 0 ? undefined : index - 1),
    );

    const roots = buildStageTree(input);

    expect(roots).toHaveLength(1);
    const flat = flatten(roots);
    expect(flat).toHaveLength(depth);
    expect(new Set(flat).size).toBe(depth);
  });
});

describe('stage expansion keys', () => {
  it('keys stages and retry groups by index, never by name', () => {
    expect(getStageExpansionKey(3)).toBe('stage:3');
    expect(getGroupExpansionKey(3)).toBe('group:3');
  });
});
