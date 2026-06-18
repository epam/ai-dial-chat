import {
  DialCheckbox,
  DialDropdown,
  DialLinkButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC } from 'react';
import { DEFAULT_MATURITY_OPTIONS } from '../../constants/catalog-defaults';
import { getMaturityLabel } from '../../utils/catalog-filter';

/** Props for MaturityFilter. */
export interface MaturityFilterProps {
  /** Currently selected maturity values. */
  selected: Set<string>;
  /** Called when the selection changes. */
  onChange: (selected: Set<string>) => void;
  /** Available maturity options. Default: DEFAULT_MATURITY_OPTIONS. */
  options?: string[];
  /** Button label when nothing is selected. Default: 'Maturity'. */
  defaultLabel?: string;
}

/** Dropdown filter for maturity stage. */
export const MaturityFilter: FC<MaturityFilterProps> = ({
  selected,
  onChange,
  options = DEFAULT_MATURITY_OPTIONS,
  defaultLabel = 'Maturity',
}) => {
  const toggle = (m: string) => {
    const next = new Set(selected);
    if (next.has(m)) {
      next.delete(m);
    } else {
      next.add(m);
    }
    onChange(next);
  };

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
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {options.map((m) => (
            <div key={m} style={{ padding: '7px 12px' }}>
              <DialCheckbox
                id={`maturity-${m}`}
                label={m}
                checked={selected.has(m)}
                onChange={() => toggle(m)}
              />
            </div>
          ))}
        </div>
      )}
    >
      <DialLinkButton
        label={getMaturityLabel(selected, options, defaultLabel)}
        iconAfter={<IconChevronDown size={16} />}
        onClick={() => undefined}
        style={
          selected.size > 0
            ? { color: 'var(--text-accent-primary, #7DA4FF)' }
            : undefined
        }
      />
    </DialDropdown>
  );
};
