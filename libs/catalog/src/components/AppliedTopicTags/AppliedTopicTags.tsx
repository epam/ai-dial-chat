import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { LinkButton, Tag } from '@epam/ai-dial-ui-kit';
import {
  FC,
  RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CLEAR_ALL_TAG_THRESHOLD } from '../../constants/catalog-folders';

/** Props for AppliedTopicTags. */
export interface AppliedTopicTagsProps {
  /** Applied topics; nothing renders while empty. */
  topics: Set<string>;
  /** Called with the remaining topics when a tag is removed, or an empty set on "Clear all". */
  onChange: (topics: Set<string>) => void;
  /** Accessible name of the tag group. Default: 'Applied topics'. */
  appliedTopicsLabel?: string;
  /** Text of the trailing button that clears every topic. Default: 'Clear all'. */
  clearAllLabel?: string;
  /** Returns the accessible name of a tag's remove button. Default: `` (topic) => `Remove ${topic}` ``. */
  formatRemoveTopicLabel?: (topic: string) => string;
  /** Element that takes focus when the last tag is removed, e.g. the filter trigger. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  /** Extra classes for the group. */
  className?: string;
}

const defaultFormatRemoveTopicLabel = (topic: string) => `Remove ${topic}`;

/** Row of removable tags for the applied topic filters, with "Clear all" from three tags. */
export const AppliedTopicTags: FC<AppliedTopicTagsProps> = ({
  topics,
  onChange,
  appliedTopicsLabel = 'Applied topics',
  clearAllLabel = 'Clear all',
  formatRemoveTopicLabel = defaultFormatRemoveTopicLabel,
  fallbackFocusRef,
  className,
}) => {
  const sorted = useMemo(() => [...topics].sort(), [topics]);
  const tagRefs = useRef<(HTMLSpanElement | null)[]>([]);
  /* Index of the tag whose remove button takes focus after a removal; -1 is
   * the fallback element. Applied once the new tag list has rendered. */
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (pendingFocus == null) return;
    setPendingFocus(null);
    const target =
      pendingFocus >= 0
        ? tagRefs.current[pendingFocus]?.querySelector('button')
        : null;
    (target ?? fallbackFocusRef?.current)?.focus();
  }, [pendingFocus, sorted, fallbackFocusRef]);

  const handleRemove = useCallback(
    (topic: string) => {
      const index = sorted.indexOf(topic);
      const next = new Set(topics);
      next.delete(topic);
      // The next tag slides into `index`; with none, take the previous one.
      const remaining = sorted.length - 1;
      setPendingFocus(index < remaining ? index : remaining - 1);
      onChange(next);
    },
    [sorted, topics, onChange],
  );

  const handleClearAll = useCallback(() => {
    setPendingFocus(-1);
    onChange(new Set());
  }, [onChange]);

  if (sorted.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={appliedTopicsLabel}
      className={mergeClasses('flex flex-wrap items-center gap-2', className)}
    >
      {sorted.map((topic, i) => (
        <span
          key={topic}
          className="contents"
          ref={(el) => {
            tagRefs.current[i] = el;
          }}
        >
          <Tag
            label={topic}
            closable
            removeLabel={formatRemoveTopicLabel(topic)}
            onRemove={() => handleRemove(topic)}
          />
        </span>
      ))}
      {sorted.length >= CLEAR_ALL_TAG_THRESHOLD && (
        <LinkButton label={clearAllLabel} onClick={handleClearAll} />
      )}
    </div>
  );
};
