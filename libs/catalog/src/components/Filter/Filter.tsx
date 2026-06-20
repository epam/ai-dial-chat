import {
  DialDropdown,
  DialLinkButton,
  DIAL_ICON_SIZE,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC } from 'react';
import { getFromLabel } from '../../utils/catalog-filter';
import styles from './Filter.module.scss';

/** Props for FromFilter. */
export interface FilterProps {
  /** Set of currently checked source IDs. */
  checked: Set<string>;
  /** Called when the checked set changes. */
  onChange: (checked: Set<string>) => void;
  /** All possible source topics, used to determine if "All" are selected. */
  values?: Set<string>;
  /** Button label when all or none are selected. Default: 'From'. */
  defaultLabel?: string;
}

/** Hierarchical tree-checkbox dropdown filter for item sources. */
export const Filter: FC<FilterProps> = ({
  checked,
  onChange,
  values,
  defaultLabel = 'From',
}) => {
  const isActive = checked.size < (values?.size ?? 0);

  return (
    <DialDropdown
      matchReferenceWidth={false}
      renderOverlay={() => (
        <div
          className="bg-layer-2 px-2"
          style={{
            border: '1px solid var(--stroke-secondary, #242c42)',
            borderRadius: 6,
            padding: '6px 0',
            minWidth: 220,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {/* {tree.map((node) => (
            // <TreeCheckboxRow
            //   key={node.id}
            //   node={node}
            //   depth={0}
            //   checked={checked}
            //   onToggle={(n) => onChange(applyToggle(n, checked))}
            // />
          ))} */}
        </div>
      )}
    >
      <DialLinkButton
        label={getFromLabel(checked, values, defaultLabel)}
        iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} />}
        className={isActive ? styles.activeLabel : undefined}
      />
    </DialDropdown>
  );
};
