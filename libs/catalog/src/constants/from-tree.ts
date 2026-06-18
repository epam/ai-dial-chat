import type { TreeNode } from '../models/catalog';
import { getAllNodeIds } from '../utils/catalog-tree';

/**
 * Default source hierarchy for the "From" filter.
 * Consumers should replace this with their own org structure via props.
 */
export const DEFAULT_FROM_TREE: TreeNode[] = [
  {
    id: 'epam',
    label: 'EPAM',
    children: [
      { id: 'epam-ukraine', label: 'EPAM Ukraine', children: [] },
      { id: 'design-competence', label: 'Design Competence', children: [] },
      {
        id: 'dial',
        label: 'DIAL',
        children: [
          { id: 'dial-design', label: 'DIAL Design', children: [] },
          { id: 'marketing-design', label: 'Marketing Design', children: [] },
        ],
      },
    ],
  },
  { id: 'me', label: 'Me', children: [] },
];

/** All node IDs in DEFAULT_FROM_TREE, pre-computed for initial filter state. */
export const DEFAULT_ALL_FROM_IDS: Set<string> = new Set(
  getAllNodeIds(DEFAULT_FROM_TREE),
);
