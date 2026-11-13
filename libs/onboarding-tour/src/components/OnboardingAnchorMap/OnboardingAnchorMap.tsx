import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CloseButton, ElementSize, mergeClasses } from '@epam/ai-dial-ui-kit';
import { FloatingPortal } from '@floating-ui/react';
import { useCallback, useId, useState, type FC } from 'react';
import { ONBOARDING_ANCHOR_MAP_CLASS } from '../../constants/public-class-names';
import type { OnboardingAnchorMapProps } from '../../models/onboarding-tour';
import { AnchorOutline } from '../AnchorOutline/AnchorOutline';
import styles from './OnboardingAnchorMap.module.scss';

const defaultSummary = (found: number, total: number) =>
  `${found} of ${total} anchors on this page`;

/** Outlines every anchor on screen with its name and lists the anchors the page does not render. */
export const OnboardingAnchorMap: FC<OnboardingAnchorMapProps> = ({
  anchors,
  onClose,
  dir,
  labels,
  colors,
  tagClassName = 'dial-tiny-semi-text',
  summaryClassName = 'dial-small-semi-text',
  itemClassName = 'dial-tiny-text',
  className,
}) => {
  const [onScreenIds, setOnScreenIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const headingId = useId();

  const handleAvailabilityChange = useCallback(
    (id: string, isOnScreen: boolean) =>
      setOnScreenIds((current) => {
        if (current.has(id) === isOnScreen) {
          return current;
        }
        const next = new Set(current);
        if (isOnScreen) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      }),
    [],
  );

  const missing = anchors.filter(({ id }) => !onScreenIds.has(id));
  const found = anchors.length - missing.length;
  const summary = (labels?.summary ?? defaultSummary)(found, anchors.length);

  const cssVars = buildCssVars({
    '--oam-outline': colors?.outline,
    '--oam-tag-bg': colors?.tagBackground,
    '--oam-tag-text': colors?.tagText,
    '--oam-panel-bg': colors?.panelBackground,
    '--oam-panel-border': colors?.panelBorder,
    '--oam-panel-shadow': colors?.panelShadow,
    '--oam-panel-text': colors?.panelText,
    '--oam-panel-muted-text': colors?.panelMutedText,
  });

  return (
    <FloatingPortal>
      {/* Clicks pass through to the page, so the anchors stay usable. */}
      <div
        dir={dir}
        style={cssVars}
        className={mergeClasses(
          ONBOARDING_ANCHOR_MAP_CLASS.root,
          'pointer-events-none fixed inset-0 z-70',
          className,
        )}
      >
        {anchors.map((anchor) => (
          <AnchorOutline
            key={anchor.id}
            anchor={anchor}
            onAvailabilityChange={handleAvailabilityChange}
            tagClassName={tagClassName}
          />
        ))}
        <section
          aria-labelledby={headingId}
          className={mergeClasses(
            ONBOARDING_ANCHOR_MAP_CLASS.panel,
            styles.panel,
            'pointer-events-auto fixed inset-e-4 bottom-4 flex max-h-[50vh] w-72 max-w-[calc(100vw-32px)] flex-col gap-2 overflow-auto rounded-lg border p-3',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <h2
              id={headingId}
              className={mergeClasses(styles.summary, summaryClassName)}
            >
              {summary}
            </h2>
            <CloseButton
              ariaLabel={labels?.close ?? 'Close anchor view'}
              size={ElementSize.Standard}
              onClose={onClose}
            />
          </div>
          {missing.length > 0 ? (
            <>
              <h3 className={mergeClasses(styles.item, itemClassName)}>
                {labels?.missingHeading ?? 'Not on this page'}
              </h3>
              <ul className="flex flex-col gap-1">
                {missing.map(({ id }) => (
                  <li
                    key={id}
                    className={mergeClasses(styles.item, itemClassName)}
                  >
                    <code>{id}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={mergeClasses(styles.item, itemClassName)}>
              {labels?.noneMissing ?? 'Every anchor is on this page'}
            </p>
          )}
        </section>
      </div>
    </FloatingPortal>
  );
};
