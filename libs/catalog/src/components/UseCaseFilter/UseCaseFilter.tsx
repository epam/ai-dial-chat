import {
  DialCheckbox,
  DialDropdown,
  DialLinkButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC } from 'react';
import { DEFAULT_USE_CASE_OPTIONS } from '../../constants/catalog-defaults';
import { getUseCaseLabel } from '../../utils/catalog-filter';

/** Props for UseCaseFilter. */
export interface UseCaseFilterProps {
  /** Currently selected use-case values. */
  selected: Set<string>;
  /** Called when the selection changes. */
  onChange: (selected: Set<string>) => void;
  /** Available use-case options. Default: DEFAULT_USE_CASE_OPTIONS. */
  options?: string[];
  /** Button label when nothing is selected. Default: 'Use case'. */
  defaultLabel?: string;
}

/** Dropdown filter for use-case categories. */
export const UseCaseFilter: FC<UseCaseFilterProps> = ({
  selected,
  onChange,
  options = DEFAULT_USE_CASE_OPTIONS,
  defaultLabel = 'Use case',
}) => {
  const toggle = (u: string) => {
    const next = new Set(selected);
    if (next.has(u)) {
      next.delete(u);
    } else {
      next.add(u);
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
            minWidth: 220,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {options.map((u) => (
            <div key={u} style={{ padding: '7px 12px' }}>
              <DialCheckbox
                id={`uc-${u}`}
                label={u}
                checked={selected.has(u)}
                onChange={() => toggle(u)}
              />
            </div>
          ))}
        </div>
      )}
    >
      <DialLinkButton
        label={getUseCaseLabel(selected, options, defaultLabel)}
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
