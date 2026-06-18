import { DialDropdown, DialLinkButton } from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC } from 'react';
import {
  DEFAULT_ALL_FROM_IDS,
  DEFAULT_FROM_TREE,
} from '../../constants/from-tree';
import type { TreeNode } from '../../models/catalog-item';
import { getFromLabel } from '../../utils/catalog-filter';
import { applyToggle } from '../../utils/catalog-tree';
import { TreeCheckboxRow } from '../TreeCheckboxRow/TreeCheckboxRow';

/** Props for FromFilter. */
export interface FromFilterProps {
  /** Set of currently checked source IDs. */
  checked: Set<string>;
  /** Called when the checked set changes. */
  onChange: (checked: Set<string>) => void;
  /** Source hierarchy tree. Default: DEFAULT_FROM_TREE. */
  tree?: TreeNode[];
  /** All node IDs in the tree (used to detect "all selected" state). Default: DEFAULT_ALL_FROM_IDS. */
  allIds?: Set<string>;
  /** Button label when all or none are selected. Default: 'From'. */
  defaultLabel?: string;
}

/** Hierarchical tree-checkbox dropdown filter for item sources. */
export const FromFilter: FC<FromFilterProps> = ({
  checked,
  onChange,
  tree = DEFAULT_FROM_TREE,
  allIds = DEFAULT_ALL_FROM_IDS,
  defaultLabel = 'From',
}) => {
  const isActive = checked.size < allIds.size;

  return (
    <DialDropdown
      matchReferenceWidth={false}
      renderOverlay={() => (
        <div
          className="bg-layer-2"
          style={{
            border: '1px solid var(--stroke-secondary, #242c42)',
            borderRadius: 6,
            padding: '6px 0',
            minWidth: 220,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {tree.map((node) => (
            <TreeCheckboxRow
              key={node.id}
              node={node}
              depth={0}
              checked={checked}
              onToggle={(n) => onChange(applyToggle(n, checked))}
            />
          ))}
        </div>
      )}
    >
      <DialLinkButton
        label={getFromLabel(checked, allIds, tree, defaultLabel)}
        iconAfter={<IconChevronDown size={16} />}
        onClick={() => undefined}
        style={
          isActive
            ? { color: 'var(--text-accent-primary, #7DA4FF)' }
            : undefined
        }
      />
    </DialDropdown>
  );
};
