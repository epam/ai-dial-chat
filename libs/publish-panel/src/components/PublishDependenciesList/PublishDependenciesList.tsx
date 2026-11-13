import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DialItemType,
  FileIcon,
  LiveRegion,
  LiveRegionElement,
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { FC, useId } from 'react';
import { PUBLISH_PANEL_CLASS } from '../../constants/public-class-names';
import type {
  PublishDependenciesLabels,
  PublishDependenciesListProps,
} from '../../models/publish-dependencies-list';
import {
  PublishDependencyType,
  type PublishDependency,
} from '../../models/publish-dependency';
import styles from './PublishDependenciesList.module.scss';

const DEFAULT_TYPE_LABELS: Record<PublishDependencyType, string> = {
  [PublishDependencyType.Application]: 'Application',
  [PublishDependencyType.Toolset]: 'Toolset',
  [PublishDependencyType.Prompt]: 'Prompt',
  [PublishDependencyType.Skill]: 'Skill',
  [PublishDependencyType.File]: 'File',
};

/** Edge of the square holding each row's icon, in px. */
const ICON_BOX_SIZE = 32;
/** Edge of the file-type glyph inside that square, in px. */
const FILE_GLYPH_SIZE = 24;

/**
 * The icon of a dependency: the file-type or folder glyph for a file, and for
 * any other kind the entity's own icon, or the initials of its name when it has
 * none. Decorative, because the name always stands beside it.
 */
const renderDependencyIcon = (dependency: PublishDependency) => (
  <span aria-hidden="true" className="shrink-0">
    {dependency.type === PublishDependencyType.File ? (
      <span
        className="flex items-center justify-center"
        style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE }}
      >
        <FileIcon
          decorative
          size={FILE_GLYPH_SIZE}
          name={dependency.name}
          type={dependency.isFolder ? DialItemType.Folder : DialItemType.File}
        />
      </span>
    ) : (
      <DeploymentIcon
        size={ICON_BOX_SIZE}
        src={dependency.iconUrl}
        initialsName={dependency.name}
        styles={{ badgeClassName: 'rounded-lg' }}
      />
    )}
  </span>
);

const DEFAULT_TITLE = 'Private dependencies';
const DEFAULT_DESCRIPTION =
  'This item depends on personal private resources (listed below). After publishing, other users may not be able to use it fully, or may run into problems.';

const defaultAnnouncement = (count: number): string =>
  `${count} ${count === 1 ? 'dependency is' : 'dependencies are'} not public yet`;

/**
 * Read-only list of the resources the item being published refers to that are
 * not in the public bucket. Renders nothing visible while `dependencies` is
 * empty; the hidden live region stays mounted so the list appearing later is
 * announced.
 */
export const PublishDependenciesList: FC<PublishDependenciesListProps> = ({
  dependencies,
  labels = {},
  headingClassName = 'dial-body-semi-text',
  nameClassName = 'dial-small-semi-text',
  metaClassName = 'dial-small-text',
  styles: stylesProp = {},
}) => {
  const headingId = useId();
  const {
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    typeLabels = {},
    getAnnouncement = defaultAnnouncement,
  }: PublishDependenciesLabels = labels;
  const { colors } = stylesProp;
  const cssVars = {
    ...buildCssVars({
      '--pp-dependencies-heading-text': colors?.headingText,
      '--pp-dependencies-name-text': colors?.nameText,
      '--pp-dependencies-meta-text': colors?.metaText,
    }),
    ...stylesProp.cssVars,
  };
  const count = dependencies.length;

  return (
    <>
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {count > 0 ? getAnnouncement(count) : ''}
      </LiveRegion>
      {count > 0 && (
        <section
          aria-labelledby={headingId}
          className={mergeClasses(
            'flex flex-col gap-3',
            PUBLISH_PANEL_CLASS.dependencies,
          )}
          style={cssVars}
        >
          <h2
            id={headingId}
            className={mergeClasses(headingClassName, styles.heading)}
          >
            {title}
          </h2>
          <Notification
            type={NotificationType.SectionMessage}
            variant={NotificationVariant.Warning}
            message={description}
            role="note"
          />
          <ul className={PUBLISH_PANEL_CLASS.dependenciesList}>
            {dependencies.map((dependency) => {
              const typeLabel =
                typeLabels[dependency.type] ??
                DEFAULT_TYPE_LABELS[dependency.type];
              return (
                <li
                  key={dependency.id}
                  className={mergeClasses(
                    'flex items-center gap-3 py-2',
                    PUBLISH_PANEL_CLASS.dependenciesItem,
                  )}
                >
                  {renderDependencyIcon(dependency)}
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={mergeClasses(
                        'truncate',
                        nameClassName,
                        styles.name,
                      )}
                    >
                      {dependency.name}
                      {dependency.version != null && (
                        <span
                          className={mergeClasses(
                            'ms-2',
                            metaClassName,
                            styles.meta,
                          )}
                        >
                          {dependency.version}
                        </span>
                      )}
                    </span>
                    <span
                      className={mergeClasses(
                        'truncate',
                        metaClassName,
                        styles.meta,
                      )}
                    >
                      {dependency.location
                        ? `${typeLabel} · ${dependency.location}`
                        : typeLabel}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
};
