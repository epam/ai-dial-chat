import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostButton } from '@epam/ai-dial-kit';
import {
  DialCheckbox,
  DialDropdown,
  DIAL_ICON_SIZE,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconFilter } from '@tabler/icons-react';
import { FC } from 'react';
import { getFromLabel } from '../../utils/catalog-filter';
import styles from './Filter.module.scss';

/** Props for Filter. */
export interface FilterProps {
  /** Set of topic strings currently selected for filtering. Empty = no topic filter. */
  checked: Set<string>;
  /** Called when the topic selection changes. */
  onChange: (checked: Set<string>) => void;
  /** All available topic strings shown as checkboxes. */
  values?: Set<string>;
  /** Whether the "My Apps" filter checkbox is active. */
  isMyAppsActive?: boolean;
  /** Called when the "My Apps" toggle changes. */
  onMyAppsChange?: (isActive: boolean) => void;
  /** Label for the "My Apps" checkbox. Default: 'My Apps'. */
  myAppsLabel?: string;
  /** Label for the Topics section heading. Default: 'Topics'. */
  topicsLabel?: string;
  /** CSS class for the Topics section heading. Default: 'dial-tiny-text'. */
  topicsSectionClassName?: string;
  /** Button label when nothing is filtered. Default: 'From'. */
  defaultLabel?: string;
}

const getFilterButtonLabel = (
  checked: Set<string>,
  values: Set<string> | undefined,
  isMyAppsActive: boolean | undefined,
  myAppsLabel: string,
  defaultLabel: string,
): string => {
  const hasTopics = checked.size > 0;
  if (isMyAppsActive && hasTopics) return `${myAppsLabel} · ${checked.size}`;
  if (isMyAppsActive) return myAppsLabel;
  if (hasTopics) return getFromLabel(checked, values, defaultLabel);
  return defaultLabel;
};

const toggleTopic = (topic: string, checked: Set<string>): Set<string> => {
  const next = new Set(checked);
  if (next.has(topic)) {
    next.delete(topic);
  } else {
    next.add(topic);
  }
  return next;
};

/** Dropdown filter with a "My Apps" toggle and a flat topic-checkbox list. */
export const Filter: FC<FilterProps> = ({
  checked,
  onChange,
  values,
  isMyAppsActive,
  onMyAppsChange,
  myAppsLabel = 'My Apps',
  topicsLabel = 'Topics',
  topicsSectionClassName = 'dial-tiny-text',
  defaultLabel = 'From',
}) => {
  const isActive = (isMyAppsActive ?? false) || checked.size > 0;
  const topics = values != null ? [...values].sort() : [];

  const buttonLabel = getFilterButtonLabel(
    checked,
    values,
    isMyAppsActive,
    myAppsLabel,
    defaultLabel,
  );

  return (
    <DialDropdown
      matchReferenceWidth={false}
      renderOverlay={() => (
        <div
          className={mergeClasses(
            styles.overlay,
            'min-w-[220px] rounded py-1 shadow',
          )}
        >
          {/* My Apps toggle */}
          <div
            className={mergeClasses(
              'flex min-h-[34px] w-full cursor-pointer items-center rounded px-3',
              styles.item,
            )}
          >
            <DialCheckbox
              id="filter-my-apps"
              label={myAppsLabel}
              checked={isMyAppsActive ?? false}
              onChange={(v) => onMyAppsChange?.(v ?? false)}
            />
          </div>

          {topics.length > 0 && (
            <>
              <div className={mergeClasses(styles.separator, 'mx-1 my-1')} />

              <div
                className={mergeClasses(
                  'px-3 py-1',
                  styles.sectionLabel,
                  topicsSectionClassName,
                )}
              >
                {topicsLabel}
              </div>

              <div className="max-h-[240px] overflow-y-auto">
                {topics.map((topic) => (
                  <div
                    key={topic}
                    className={mergeClasses(
                      'flex min-h-[34px] w-full cursor-pointer items-center rounded px-3',
                      styles.item,
                    )}
                  >
                    <DialCheckbox
                      id={`filter-topic-${topic}`}
                      label={topic}
                      checked={checked.has(topic)}
                      onChange={() => onChange(toggleTopic(topic, checked))}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    >
      <GhostButton
        label={buttonLabel}
        iconBefore={<IconFilter size={DIAL_ICON_SIZE.SM} />}
        iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} />}
        className={mergeClasses(styles.chip, isActive && styles.chipActive)}
      />
    </DialDropdown>
  );
};
