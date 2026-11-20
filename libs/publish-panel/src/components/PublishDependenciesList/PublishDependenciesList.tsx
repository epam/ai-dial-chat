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
import {
  PublishDependenciesAppearance,
  type PublishDependenciesLabels,
  type PublishDependenciesListProps,
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

/** Edge of the square holding each row's icon in the `Warning` appearance, in px. */
const ICON_BOX_SIZE = 32;
/** Edge of the file-type glyph inside that square, in px. */
const FILE_GLYPH_SIZE = 24;
/** Edge of the square holding each row's icon in the `Published` appearance, in px. */
const PUBLISHED_ICON_BOX_SIZE = 40;
/** Edge of the file-type glyph inside that square, in px. */
const PUBLISHED_FILE_GLYPH_SIZE = 32;

/**
 * The icon of a dependency: the file-type or folder glyph for a file, and for
 * any other kind the entity's own icon, or the initials of its name when it has
 * none. Decorative, because the name always stands beside it.
 */
const renderDependencyIcon = (
  dependency: PublishDependency,
  isPublished: boolean,
) => {
  const boxSize = isPublished ? PUBLISHED_ICON_BOX_SIZE : ICON_BOX_SIZE;
  return (
    <span aria-hidden="true" className="shrink-0">
      {dependency.type === PublishDependencyType.File ? (
        <span
          className="flex items-center justify-center"
          style={{ width: boxSize, height: boxSize }}
        >
          <FileIcon
            decorative
            size={isPublished ? PUBLISHED_FILE_GLYPH_SIZE : FILE_GLYPH_SIZE}
            name={dependency.name}
            type={dependency.isFolder ? DialItemType.Folder : DialItemType.File}
          />
        </span>
      ) : (
        <DeploymentIcon
          size={boxSize}
          src={dependency.iconUrl}
          initialsName={dependency.name}
          styles={{ badgeClassName: isPublished ? 'rounded-xl' : 'rounded-lg' }}
        />
      )}
    </span>
  );
};

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
  nameClassName,
  metaClassName = 'dial-small-text',
  captionClassName = 'dial-tiny-text',
  typeClassName = 'dial-tiny-lead-semi-text',
  styles: stylesProp = {},
}) => {
  const headingId = useId();
  const {
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    appearance = PublishDependenciesAppearance.Warning,
    typeLabels = {},
    getAnnouncement = defaultAnnouncement,
  }: PublishDependenciesLabels = labels;
  const isPublished = appearance === PublishDependenciesAppearance.Published;
  const resolvedNameClassName =
    nameClassName ??
    (isPublished ? 'dial-body-semi-text' : 'dial-small-semi-text');
  const { colors } = stylesProp;
  const cssVars = {
    ...buildCssVars({
      '--pp-dependencies-heading-text': colors?.headingText,
      '--pp-dependencies-name-text': colors?.nameText,
      '--pp-dependencies-meta-text': colors?.metaText,
      '--pp-dependencies-caption-text': colors?.captionText,
      '--pp-dependencies-type-text': colors?.typeText,
      '--pp-dependencies-divider': colors?.divider,
    }),
    ...stylesProp.cssVars,
  };
  const count = dependencies.length;

  const renderWarningRow = (dependency: PublishDependency) => {
    const typeLabel =
      typeLabels[dependency.type] ?? DEFAULT_TYPE_LABELS[dependency.type];
    return (
      <li
        key={dependency.id}
        className={mergeClasses(
          'flex items-center gap-3 py-2',
          PUBLISH_PANEL_CLASS.dependenciesItem,
        )}
      >
        {renderDependencyIcon(dependency, false)}
        <div className="flex min-w-0 flex-col">
          <span
            className={mergeClasses(
              'truncate',
              resolvedNameClassName,
              styles.name,
            )}
          >
            {dependency.name}
            {dependency.version != null && (
              <span
                className={mergeClasses('ms-2', metaClassName, styles.meta)}
              >
                {dependency.version}
              </span>
            )}
          </span>
          <span
            className={mergeClasses('truncate', metaClassName, styles.meta)}
          >
            {dependency.location
              ? `${typeLabel} · ${dependency.location}`
              : typeLabel}
          </span>
        </div>
      </li>
    );
  };

  const renderPublishedRow = (dependency: PublishDependency) => {
    const typeLabel =
      typeLabels[dependency.type] ?? DEFAULT_TYPE_LABELS[dependency.type];
    return (
      <li
        key={dependency.id}
        className={mergeClasses(
          'flex items-center gap-3 py-3',
          styles.row,
          PUBLISH_PANEL_CLASS.dependenciesItem,
        )}
      >
        {renderDependencyIcon(dependency, true)}
        <div className="flex min-w-0 flex-col">
          <span
            className={mergeClasses('truncate', typeClassName, styles.type)}
          >
            {typeLabel}
            {dependency.location && (
              <span
                className={mergeClasses(
                  'ms-1 normal-case',
                  metaClassName,
                  styles.meta,
                )}
              >
                {`· ${dependency.location}`}
              </span>
            )}
          </span>
          <span
            className={mergeClasses(
              'truncate',
              resolvedNameClassName,
              styles.name,
            )}
          >
            {dependency.name}
            {dependency.version != null && (
              <span
                className={mergeClasses('ms-2', metaClassName, styles.meta)}
              >
                {dependency.version}
              </span>
            )}
          </span>
        </div>
      </li>
    );
  };

  return (
    <>
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {count > 0 ? getAnnouncement(count) : ''}
      </LiveRegion>
      {count > 0 && (
        <section
          aria-labelledby={headingId}
          className={mergeClasses(
            'flex flex-col',
            isPublished ? 'gap-2' : 'gap-3',
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
          {isPublished ? (
            <p className={mergeClasses(captionClassName, styles.caption)}>
              {description}
            </p>
          ) : (
            <Notification
              type={NotificationType.SectionMessage}
              variant={NotificationVariant.Warning}
              message={description}
              role="note"
            />
          )}
          <ul className={PUBLISH_PANEL_CLASS.dependenciesList}>
            {dependencies.map(
              isPublished ? renderPublishedRow : renderWarningRow,
            )}
          </ul>
        </section>
      )}
    </>
  );
};
