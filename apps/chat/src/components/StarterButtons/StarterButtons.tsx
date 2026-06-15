import type { StarterOption } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialRoundedButton,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';

interface Props {
  /** Starter options to display as buttons. */
  starters: StarterOption[];
  /** Called with the full starter option when a button is clicked. */
  onSelect: (starter: StarterOption) => void;
}

const MAX_VISIBLE = 4;
const OVERFLOW_BUTTON_WIDTH = 56;
const GAP = 8;

const StarterButtons: FC<Props> = ({ starters, onSelect }) => {
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pillWidthCacheRef = useRef<number[]>([]);

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(starters.length, MAX_VISIBLE),
  );

  const computeVisibleCount = useCallback((totalStarters: number) => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth === 0) return;

    const cap = Math.min(totalStarters, MAX_VISIBLE);
    const allMounted = pillRefs.current.slice(0, cap).every((el) => el != null);
    if (allMounted) {
      pillWidthCacheRef.current = pillRefs.current
        .slice(0, cap)
        .map((el) => el?.getBoundingClientRect().width ?? 0);
    }

    const widthOf = (i: number) => pillWidthCacheRef.current[i] ?? 120;

    let usedWidth = 0;
    let count = 0;

    for (let i = 0; i < cap; i++) {
      const pillWidth = widthOf(i);
      const remainingAfterThis = totalStarters - (i + 1);
      const needsOverflow = remainingAfterThis > 0;
      const projectedWidth =
        usedWidth +
        (i > 0 ? GAP : 0) +
        pillWidth +
        (needsOverflow ? GAP + OVERFLOW_BUTTON_WIDTH : 0);

      if (projectedWidth > containerWidth) break;

      usedWidth += (i > 0 ? GAP : 0) + pillWidth;
      count = i + 1;
    }

    setVisibleCount(Math.max(1, count));
  }, []);

  useEffect(() => {
    pillWidthCacheRef.current = [];
    setVisibleCount(Math.min(starters.length, MAX_VISIBLE));
  }, [starters.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      computeVisibleCount(starters.length);
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [computeVisibleCount, starters.length]);

  useEffect(() => {
    computeVisibleCount(starters.length);
  });

  if (starters.length === 0) return null;

  const effectiveVisible = Math.min(visibleCount, MAX_VISIBLE);
  const visibleStarters = starters.slice(0, effectiveVisible);
  const overflowStarters = starters.slice(effectiveVisible);

  const overflowItems: DropdownItem[] = overflowStarters.map(
    (starter, idx) => ({
      key: String(idx),
      label: starter.title,
      onClick: () => onSelect(starter),
    }),
  );

  return (
    <div ref={containerRef} className="mt-4 w-full">
      <div
        role="list"
        aria-label={t(ChatI18nKeys.ConversationStarters)}
        className="flex flex-wrap justify-center gap-2"
      >
        {visibleStarters.map((starter, index) => (
          <div
            key={starter.const}
            role="listitem"
            ref={(el) => {
              pillRefs.current[index] = el;
            }}
          >
            <DialRoundedButton
              label={starter.title}
              onClick={() => onSelect(starter)}
            />
          </div>
        ))}

        {overflowStarters.length > 0 && (
          <div role="listitem">
            <DialDropdown
              items={overflowItems}
              placement="bottom-end"
              matchReferenceWidth={false}
            >
              <DialRoundedButton
                iconAfter={
                  <IconDotsVertical stroke={1.5} size={DIAL_ICON_SIZE.MD} />
                }
                aria-label={t(ChatI18nKeys.StarterButtonsOverflow)}
              />
            </DialDropdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(StarterButtons);
