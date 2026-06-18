import { DialCheckbox } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { TreeNode } from '../../models/catalog-item';
import { getNodeCheckState } from '../../utils/catalog-tree';

/** Props for TreeCheckboxRow. */
export interface TreeCheckboxRowProps {
  /** The tree node to render. */
  node: TreeNode;
  /** Indentation depth (0 = root). Each level adds 16px of padding-start. */
  depth: number;
  /** Set of currently checked node IDs. */
  checked: Set<string>;
  /** Called when the user toggles this node. */
  onToggle: (node: TreeNode) => void;
}

/** Renders a tree node as a checkbox row and recurses into children. */
export const TreeCheckboxRow: FC<TreeCheckboxRowProps> = ({
  node,
  depth,
  checked,
  onToggle,
}) => {
  const state = getNodeCheckState(node, checked);
  return (
    <>
      <div
        style={{
          paddingInlineStart: 12 + depth * 16,
          paddingInlineEnd: 12,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <DialCheckbox
          id={`from-${node.id}`}
          label={node.label}
          checked={state === 'checked'}
          indeterminate={state === 'indeterminate'}
          onChange={() => onToggle(node)}
        />
      </div>
      {node.children.map((child) => (
        <TreeCheckboxRow
          key={child.id}
          node={child}
          depth={depth + 1}
          checked={checked}
          onToggle={onToggle}
        />
      ))}
    </>
  );
};
