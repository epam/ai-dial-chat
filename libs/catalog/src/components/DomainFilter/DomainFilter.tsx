import {
  DialCheckbox,
  DialDropdown,
  DialLinkButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC } from 'react';
import { DEFAULT_DOMAIN_OPTIONS } from '../../constants/catalog-defaults';
import { getDomainLabel } from '../../utils/catalog-filter';
import styles from './DomainFilter.module.scss';

/** Color overrides for `DomainFilter`, applied via CSS custom properties. */
export interface DomainFilterColors {
  /** Overlay background color. Fallback: `--bg-layer-2`. */
  overlayBackground?: string;
  /** Overlay border color. Fallback: `--stroke-secondary`. */
  overlayBorder?: string;
  /** Trigger text color when any option is selected. Fallback: `--text-accent-primary`. */
  triggerActive?: string;
}

/** Grouped style overrides for `DomainFilter`. */
export interface DomainFilterStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: DomainFilterColors;
}

/** Props for DomainFilter. */
export interface DomainFilterProps {
  /** Currently selected domain values. */
  selected: Set<string>;
  /** Called when the selection changes. */
  onChange: (selected: Set<string>) => void;
  /** Available domain options. Default: DEFAULT_DOMAIN_OPTIONS. */
  options?: string[];
  /** Button label when nothing is selected. Default: 'Domain'. */
  defaultLabel?: string;
  /** Grouped style overrides for overlay and trigger states. */
  styles?: DomainFilterStyles;
}

/** Dropdown filter for domain categories. */
export const DomainFilter: FC<DomainFilterProps> = ({
  selected,
  onChange,
  options = DEFAULT_DOMAIN_OPTIONS,
  defaultLabel = 'Domain',
  styles: domainStyles,
}) => {
  const cssVars = {
    '--cat-domain-overlay-bg': domainStyles?.colors?.overlayBackground,
    '--cat-domain-overlay-border': domainStyles?.colors?.overlayBorder,
    '--cat-domain-trigger-active': domainStyles?.colors?.triggerActive,
  } as React.CSSProperties;

  const toggle = (d: string) => {
    const next = new Set(selected);
    if (next.has(d)) {
      next.delete(d);
    } else {
      next.add(d);
    }
    onChange(next);
  };

  return (
    <DialDropdown
      matchReferenceWidth={false}
      renderOverlay={() => (
        <div
          className={[
            'min-w-[220px] rounded-[6px] border py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
            styles.overlay,
          ].join(' ')}
          style={cssVars}
        >
          {options.map((d) => (
            <div key={d} className="px-3 py-[7px]">
              <DialCheckbox
                id={`domain-${d}`}
                label={d}
                checked={selected.has(d)}
                onChange={() => toggle(d)}
              />
            </div>
          ))}
        </div>
      )}
    >
      <DialLinkButton
        label={getDomainLabel(selected, options, defaultLabel)}
        iconAfter={<IconChevronDown size={16} />}
        onClick={() => undefined}
        className={selected.size > 0 ? styles.triggerActive : undefined}
        style={cssVars}
      />
    </DialDropdown>
  );
};
