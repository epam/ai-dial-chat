import type { Stage } from '@epam/ai-dial-chat-shared';
import type { StageNode } from '../models/stage-tree';

/*
 * A parent reference is usable only when it is a nonnegative integer that
 * resolves to another stage with a smaller index. Strictly decreasing parent
 * indexes rule out cycles without walking ancestors.
 */
const findParent = (
  stage: Stage,
  nodesByIndex: Map<number, StageNode>,
): StageNode | undefined => {
  const parentIndex = stage.parent_stage_index;
  if (
    parentIndex == null ||
    !Number.isInteger(parentIndex) ||
    parentIndex < 0 ||
    parentIndex >= stage.index
  ) {
    return undefined;
  }
  return nodesByIndex.get(parentIndex);
};

/**
 * Derives the display forest from a flat, normalized stage array in O(n).
 * Roots and each child list keep input encounter order; a stage whose parent
 * reference is missing, unknown, self/forward-pointing or malformed becomes a
 * root. Every input stage appears exactly once; the input is not mutated.
 */
export const buildStageTree = (stages: Stage[]): StageNode[] => {
  const nodes = stages.map((stage) => ({ stage, children: [] as StageNode[] }));
  const nodesByIndex = new Map<number, StageNode>();
  for (const node of nodes) {
    if (!nodesByIndex.has(node.stage.index)) {
      nodesByIndex.set(node.stage.index, node);
    }
  }

  const roots: StageNode[] = [];
  for (const node of nodes) {
    const parent = findParent(node.stage, nodesByIndex);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
};

/** Disclosure key of a single stage — its stable index, never its streaming name. */
export const getStageExpansionKey = (stageIndex: number): string =>
  `stage:${stageIndex}`;

/** Disclosure key of a `×N` retry group — its first attempt's index. */
export const getGroupExpansionKey = (firstAttemptIndex: number): string =>
  `group:${firstAttemptIndex}`;
