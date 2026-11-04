import { AttachmentCard } from '@epam/ai-dial-attachment-input';
import {
  ActionMenu,
  buildCssVars,
  type DisplayAttachment,
  getAttachmentTypeFromMime,
  MarkdownRenderer,
  type MarkdownRendererClassNames,
  mergeClasses,
  PanelEmptyState,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
  EllipsisTooltip,
  GhostButton,
  GhostIconButton,
  NeutralButton,
  Search,
  Spinner,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import {
  IconArrowNarrowLeft,
  IconDotsVertical,
  IconDownload,
  IconPencilMinus,
  IconPin,
  IconShare,
  IconTrashX,
  IconWorldShare,
  type TablerIcon,
} from '@tabler/icons-react';
import { type FC, memo, useId, useMemo } from 'react';
import type {
  ProjectContextFileItem,
  ProjectViewProps,
} from '../../models/project-view-props';
import { filterContextFileItems } from '../../utils/context-files';
import { IconPinOff } from '../IconPinOff/IconPinOff';
import styles from './ProjectView.module.scss';

const toDisplayAttachment = (
  file: ProjectContextFileItem,
): DisplayAttachment => ({
  id: file.name,
  name: file.name,
  contentType: file.contentType,
  type: getAttachmentTypeFromMime(file.contentType),
  status: RequestStatus.Idle,
});

/** Project home page: a header with the project actions and a Details panel with description, instructions and context. */
const ProjectViewComponent: FC<ProjectViewProps> = ({
  project,
  isLoading = false,
  hasError = false,
  isNotFound = false,
  isPinned,
  isPinPending = false,
  contextSearchQuery,
  onContextSearchQueryChange,
  onBack,
  onTogglePin,
  onPublish,
  onEdit,
  onShare,
  onDelete,
  onDownload,
  onContextFileClick,
  selectedContextFileId,
  isDetailsStacked = false,
  onRetry,
  onBrowseProjects,
  mainContent,
  mainContentLabel = 'Project content',
  labels,
  styles: viewStyles,
}) => {
  const { colors, typography } = viewStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const panelTitleClassName =
    typography?.panelTitleClassName ?? 'dial-body-semi-text';
  const sectionTitleClassName =
    typography?.sectionTitleClassName ?? 'dial-tiny-text';
  const bodyClassName = typography?.bodyClassName ?? 'dial-small-text';
  const helperClassName = typography?.helperClassName ?? 'dial-tiny-text';
  const instructionsHeadingClassName =
    typography?.instructionsHeadingClassName ?? 'dial-small-semi-text';
  const cssVars = buildCssVars({
    '--pv-bg': colors?.background,
    '--pv-border': colors?.border,
    '--pv-heading-text': colors?.headingText,
    '--pv-body-text': colors?.bodyText,
    '--pv-secondary-text': colors?.secondaryText,
  });

  const contextFiles = useMemo(() => project?.contextFiles ?? [], [project]);
  const visibleFiles = useMemo(
    () => filterContextFileItems(contextFiles, contextSearchQuery),
    [contextFiles, contextSearchQuery],
  );
  const trimmedQuery = contextSearchQuery.trim();
  const detailsHeadingId = useId();
  /* Headings inside the instructions stay on the panel's scale, so a `#`
   * line never outsizes the project title. */
  const markdownClassNames = useMemo<MarkdownRendererClassNames>(() => {
    const heading = mergeClasses(
      'mb-1 mt-3 first:mt-0',
      instructionsHeadingClassName,
    );
    return {
      h1: heading,
      h2: heading,
      h3: heading,
      h4: heading,
      h5: heading,
      h6: heading,
      p: bodyClassName,
      ul: bodyClassName,
      ol: bodyClassName,
    };
  }, [bodyClassName, instructionsHeadingClassName]);

  /* The same actions in two placements: on desktop Publish and Edit are
   * header buttons, on mobile they lead the ⋮ menu. CSS hides one copy, so
   * the hidden one is out of the accessibility tree too. */
  const renderMenuIcon = (Icon: TablerIcon) => (
    <Icon size={DIAL_ICON_SIZE.SM} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
  );

  const buildMenuItems = (includePrimary: boolean): DropdownItem[] => {
    const items: DropdownItem[] = [];
    if (includePrimary && onPublish) {
      items.push({
        key: 'publish',
        label: labels.publishLabel,
        icon: renderMenuIcon(IconWorldShare),
        onClick: onPublish,
      });
    }
    if (includePrimary && onEdit) {
      items.push({
        key: 'edit',
        label: labels.editLabel,
        icon: renderMenuIcon(IconPencilMinus),
        onClick: onEdit,
      });
    }
    if (onShare) {
      items.push({
        key: 'share',
        label: labels.shareLabel,
        icon: renderMenuIcon(IconShare),
        onClick: onShare,
      });
    }
    items.push({
      key: 'download',
      label: labels.downloadLabel,
      icon: renderMenuIcon(IconDownload),
      onClick: onDownload,
    });
    if (onDelete) {
      items.push({
        key: 'delete',
        label: labels.deleteLabel,
        icon: renderMenuIcon(IconTrashX),
        danger: true,
        onClick: onDelete,
      });
    }
    return items;
  };

  const renderMenu = (includePrimary: boolean, className: string) => (
    <div className={className}>
      <ActionMenu
        items={buildMenuItems(includePrimary)}
        title={labels.moreActionsLabel}
        closeLabel={labels.closeLabel}
        matchReferenceWidth={false}
        listClassName="w-[200px]"
      >
        <GhostIconButton
          icon={
            <IconDotsVertical
              size={DIAL_ICON_SIZE.MD}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={labels.moreActionsLabel}
        />
      </ActionMenu>
    </div>
  );

  /* `aria-disabled` rather than `disabled`: a natively disabled button drops
   * keyboard focus to <body> while the pin change is saved. */
  const handleTogglePin = () => {
    if (!isPinPending) onTogglePin();
  };

  const renderState = () => {
    if (isLoading) {
      return (
        <Spinner ariaLabel={labels.loadingAriaLabel ?? 'Loading project'} />
      );
    }
    if (hasError) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p aria-hidden className={mergeClasses(bodyClassName, styles.body)}>
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3">
        <p className={mergeClasses(bodyClassName, styles.body)}>
          {labels.notFoundLabel}
        </p>
        <GhostButton
          label={labels.browseProjectsLabel}
          onClick={onBrowseProjects}
        />
      </div>
    );
  };

  if (isLoading || hasError || isNotFound || project == null) {
    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'flex h-full w-full min-w-0 items-center justify-center p-4',
          styles.container,
        )}
      >
        {/* Mounted while loading, so the load failure is announced when it replaces the spinner. */}
        <LiveRegion visuallyHidden>
          {!isLoading && hasError && labels.errorLabel}
        </LiveRegion>
        {renderState()}
      </div>
    );
  }

  const renderContext = () => {
    if (contextFiles.length === 0) {
      return <PanelEmptyState label={labels.emptyContextLabel} />;
    }
    return (
      <>
        <div role="search">
          <Search
            value={contextSearchQuery}
            onChange={(value?: string) =>
              onContextSearchQueryChange(value ?? '')
            }
            placeholder={labels.contextSearchPlaceholder}
            clearLabel={labels.clearSearchLabel}
            aria-label={labels.contextSearchAriaLabel}
          />
        </div>
        {visibleFiles.length === 0 ? (
          <p className={mergeClasses(helperClassName, styles.secondary)}>
            {labels.noContextMatchesLabel}
          </p>
        ) : (
          <ul className="m-0 flex min-w-0 list-none flex-wrap gap-2 p-0 pt-2">
            {visibleFiles.map((file) => (
              <li key={file.name} className="min-w-0">
                <AttachmentCard
                  attachment={toDisplayAttachment(file)}
                  searchQuery={trimmedQuery}
                  onClick={onContextFileClick}
                  isSelected={file.name === selectedContextFileId}
                  labels={{ clickLabel: labels.openFileLabel(file.name) }}
                />
              </li>
            ))}
          </ul>
        )}
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {trimmedQuery === ''
            ? ''
            : labels.contextResultCountLabel(visibleFiles.length)}
        </LiveRegion>
      </>
    );
  };

  /* Beside each other on desktop the header stays put and each column
   * scrolls on its own; stacked, the columns scroll together under it. */
  const isSideBySide = !isDetailsStacked;

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex size-full min-h-0 min-w-0 flex-1 flex-col',
        styles.container,
      )}
    >
      <header
        className={mergeClasses(
          'flex min-w-0 shrink-0 items-center gap-2 px-4 py-3 desktop:px-8 desktop:py-4',
          styles.header,
        )}
      >
        <GhostIconButton
          icon={
            <IconArrowNarrowLeft
              size={DIAL_ICON_SIZE.LG}
              className="rtl:scale-x-[-1]"
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={labels.backLabel}
          onClick={onBack}
        />
        <h1
          className={mergeClasses(
            'min-w-0 flex-1',
            titleClassName,
            styles.title,
          )}
        >
          <EllipsisTooltip text={project.name} />
        </h1>
        <GhostButton
          label={isPinned ? labels.unpinLabel : labels.pinLabel}
          iconBefore={
            isPinned ? (
              <IconPinOff
                size={DIAL_ICON_SIZE.MD}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            ) : (
              <IconPin
                size={DIAL_ICON_SIZE.MD}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            )
          }
          aria-disabled={isPinPending || undefined}
          onClick={handleTogglePin}
          className="shrink-0"
        />
        {onPublish && (
          <NeutralButton
            label={labels.publishLabel}
            iconBefore={
              <IconWorldShare
                size={DIAL_ICON_SIZE.MD}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            onClick={onPublish}
            className="hidden shrink-0 desktop:inline-flex"
          />
        )}
        {onEdit && (
          <NeutralButton
            label={labels.editLabel}
            iconBefore={
              <IconPencilMinus
                size={DIAL_ICON_SIZE.MD}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            onClick={onEdit}
            className="hidden shrink-0 desktop:inline-flex"
          />
        )}
        {renderMenu(false, 'hidden desktop:block')}
        {renderMenu(true, 'desktop:hidden')}
      </header>

      <div
        className={mergeClasses(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto',
          isSideBySide && 'desktop:flex-row desktop:overflow-hidden',
          mainContent == null && isSideBySide && 'desktop:justify-end',
        )}
      >
        {mainContent != null && (
          <section
            aria-label={mainContentLabel}
            className={mergeClasses(
              'flex min-w-0 flex-1 flex-col px-4 py-6 desktop:px-8',
              isSideBySide && 'desktop:overflow-y-auto',
            )}
          >
            <div className="mx-auto flex w-full max-w-[748px] min-w-0 flex-col gap-5">
              {mainContent}
            </div>
          </section>
        )}
        {/* No card: the panel is framed only by an inline-start border on
         * desktop, and a top border where it stacks under the header. */}
        <aside
          aria-labelledby={detailsHeadingId}
          className={mergeClasses(
            'flex w-full min-w-0 flex-col gap-5 border-t px-4 py-6 desktop:px-8',
            isSideBySide &&
              'desktop:w-[488px] desktop:shrink-0 desktop:overflow-y-auto desktop:border-s desktop:border-t-0',
            styles.panel,
          )}
        >
          <h2
            id={detailsHeadingId}
            className={mergeClasses(panelTitleClassName, styles.title)}
          >
            {labels.detailsLabel}
          </h2>
          {project.description !== '' && (
            <section className="flex min-w-0 flex-col gap-1">
              <h3
                className={mergeClasses(
                  sectionTitleClassName,
                  styles.secondary,
                )}
              >
                {labels.descriptionLabel}
              </h3>
              <p
                className={mergeClasses(
                  'wrap-break-word whitespace-pre-line',
                  bodyClassName,
                  styles.body,
                )}
              >
                {project.description}
              </p>
            </section>
          )}
          {project.instructions !== '' && (
            <section className="flex min-w-0 flex-col gap-1">
              <h3
                className={mergeClasses(
                  sectionTitleClassName,
                  styles.secondary,
                )}
              >
                {labels.instructionsLabel}
              </h3>
              <div
                className={mergeClasses(
                  'min-w-0 wrap-break-word',
                  bodyClassName,
                  styles.body,
                )}
              >
                <MarkdownRenderer
                  content={project.instructions}
                  classNames={markdownClassNames}
                />
              </div>
            </section>
          )}
          <section className="flex min-w-0 flex-col gap-2">
            <h3
              className={mergeClasses(sectionTitleClassName, styles.secondary)}
            >
              {labels.contextLabel}
            </h3>
            {renderContext()}
          </section>
        </aside>
      </div>
    </div>
  );
};

/** Project home page: a header with the project actions and a Details panel with description, instructions and context. */
export const ProjectView = memo(ProjectViewComponent);
