import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  ElementSize,
  GhostButton,
  MenuItemMark,
  Search,
  Spinner,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { IconArrowsSort, IconPlus } from '@tabler/icons-react';
import { FC, useMemo } from 'react';
import type { ProjectsProps } from '../../models/projects-props';
import type { ProjectsSortKey } from '../../types/projects-sort-key';
import { filterProjects, sortProjects } from '../../utils/projects';
import { ProjectCard } from '../ProjectCard/ProjectCard';
import styles from './Projects.module.scss';

/** Projects page shell: header (a floating New project button on mobile), search + sort toolbar, and a loading, error, empty, no-results or card-grid state. */
export const Projects: FC<ProjectsProps> = ({
  projects,
  isLoading = false,
  hasError = false,
  incompleteSources = [],
  onRetry,
  onCreateProject,
  onTogglePin,
  onOpenProject,
  getProjectHref,
  searchQuery,
  onSearchQueryChange,
  sortKey,
  onSortKeyChange,
  labels,
  locale,
  styles: projectsStyles,
}) => {
  const { colors, typography } = projectsStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const subtitleClassName = typography?.subtitleClassName ?? 'dial-body-text';
  const cardTitleClassName =
    typography?.cardTitleClassName ?? 'dial-body-semi-text';
  const pathLabelClassName = typography?.pathLabelClassName ?? 'dial-tiny-text';
  const pathLeafClassName =
    typography?.pathLeafClassName ?? 'dial-tiny-semi-text';
  const updatedAtClassName = typography?.updatedAtClassName ?? 'dial-tiny-text';
  const emptyStateDescriptionClassName =
    typography?.emptyStateDescriptionClassName ?? 'dial-small-paragraph-text';
  const cssVars = buildCssVars({
    '--pr-bg': colors?.background,
    '--pr-subtitle-text': colors?.subtitleText,
    '--pr-sort-text': colors?.sortButtonText,
    '--pr-card-bg': colors?.cardBackground,
    '--pr-card-title-text': colors?.cardTitleText,
    '--pr-updated-at-text': colors?.updatedAtText,
    '--pr-path-text': colors?.pathText,
    '--pr-card-focus-outline': colors?.cardFocusOutline,
  });

  const isMobile = useIsMobile();

  /* The relative times are a snapshot, taken again whenever the projects
   * change, so a project the host updates while the page is open reads
   * "now" rather than a time relative to when the page was mounted. */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `projects` is the snapshot trigger
  const now = useMemo(() => Date.now(), [projects]);
  const trimmedQuery = searchQuery.trim();
  const isIncomplete = incompleteSources.length > 0;
  /* With nothing listed, a degraded answer must not claim "no projects yet". */
  const isFailedEmpty = isIncomplete && projects.length === 0;
  const visibleProjects = useMemo(
    () => sortProjects(filterProjects(projects, searchQuery), sortKey, locale),
    [projects, searchQuery, sortKey, locale],
  );

  /* Falls back to the control's own name so the trigger never renders without
   * an accessible name for an unrecognised sortKey. */
  const activeSortLabel =
    labels.sortOptions.find((option) => option.value === sortKey)?.label ??
    labels.sortLabel;

  const sortItems = useMemo<DropdownItem[]>(
    () =>
      labels.sortOptions.map((option) => ({
        key: option.value,
        label: option.label,
        mark: MenuItemMark.Check,
        checked: option.value === sortKey,
        onClick: () => onSortKeyChange(option.value as ProjectsSortKey),
      })),
    [labels.sortOptions, sortKey, onSortKeyChange],
  );

  const handleSearchChange = (value?: string) => {
    onSearchQueryChange(value ?? '');
  };

  const getStatusMessage = (): string | undefined => {
    if (isLoading) return undefined;
    if (hasError) return labels.errorLabel;
    if (isIncomplete) return labels.incompleteLabel;
    if (projects.length === 0) return labels.emptyStateLabel;
    if (visibleProjects.length === 0) return labels.noResultsLabel;
    return labels.resultCountLabel(visibleProjects.length);
  };

  const renderCreateButton = (variant: ButtonVariant, className?: string) =>
    onCreateProject ? (
      <Button
        label={labels.createProjectLabel}
        variant={variant}
        onClick={onCreateProject}
        className={mergeClasses('shrink-0', className)}
      />
    ) : undefined;

  const renderContent = () => {
    if (isLoading) {
      return <Spinner />;
    }

    if (hasError || isFailedEmpty) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
            {hasError ? labels.errorLabel : labels.incompleteLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      );
    }

    if (projects.length === 0) {
      /* The kit spaces the action 16px below the text; the design asks for 24px. */
      return (
        <PanelEmptyState
          label={labels.emptyStateLabel}
          description={labels.emptyStateDescription}
          action={renderCreateButton(ButtonVariant.Secondary, 'mt-2')}
          containerClassName={emptyStateContainerClassName}
          labelClassName="mt-3"
          descriptionClassName={emptyStateDescriptionClassName}
        />
      );
    }

    if (visibleProjects.length === 0) {
      return (
        <PanelEmptyState
          label={labels.noResultsLabel}
          containerClassName={emptyStateContainerClassName}
          labelClassName="mt-3"
        />
      );
    }

    return (
      <ul className="m-0 grid w-full min-w-0 list-none grid-cols-1 gap-4 p-0 desktop:grid-cols-3 desktop:gap-5">
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            searchQuery={trimmedQuery}
            sourceLabel={labels.sourceLabels[project.source]}
            folderPathLabel={labels.folderPathLabel}
            pinnedLabel={labels.pinnedLabel ?? 'Pinned'}
            pinLabel={labels.pinLabel ?? 'Pin'}
            onTogglePin={onTogglePin}
            href={getProjectHref?.(project.id)}
            onOpen={onOpenProject}
            now={now}
            locale={locale}
            updatedAtClassName={updatedAtClassName}
            titleClassName={cardTitleClassName}
            pathLabelClassName={pathLabelClassName}
            pathLeafClassName={pathLeafClassName}
          />
        ))}
      </ul>
    );
  };

  const isCentered = isLoading || hasError || isFailedEmpty;
  /* On mobile the cards start right under the toolbar while an empty state
   * keeps the design's 24px gap. */
  const emptyStateContainerClassName = 'mt-6 p-3 desktop:mt-0';

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'relative flex h-full w-full min-w-0 flex-col',
        styles.container,
      )}
    >
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto">
        {isMobile ? (
          /* The mobile design has no page header: the app bar names the
           * page and New project floats, so the title stays for assistive
           * tech only. */
          <h1 className="sr-only">{labels.title}</h1>
        ) : (
          <div className="flex min-w-0 items-start gap-2 px-8 py-4">
            <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center gap-0.5">
              <h1 className={mergeClasses('wrap-break-word', titleClassName)}>
                {labels.title}
              </h1>
              {labels.subtitle && (
                <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
                  {labels.subtitle}
                </p>
              )}
            </div>
            {renderCreateButton(ButtonVariant.Primary)}
          </div>
        )}

        <div className="flex items-center gap-2 p-4 desktop:gap-3 desktop:px-8 desktop:pt-4 desktop:pb-5">
          <div role="search" className="min-w-0 flex-1">
            <Search
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={labels.searchPlaceholder}
              clearLabel={labels.clearSearchLabel}
              aria-label={labels.searchAriaLabel}
              size={isMobile ? ElementSize.Standard : ElementSize.Large}
            />
          </div>
          {labels.sortOptions.length > 0 && (
            <div
              role="group"
              aria-label={labels.sortLabel}
              className="shrink-0"
            >
              <ButtonDropdown
                items={sortItems}
                label={activeSortLabel}
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Ghost}
                size={isMobile ? ElementSize.Small : ElementSize.Standard}
                iconBefore={
                  <IconArrowsSort
                    size={isMobile ? DIAL_ICON_SIZE.SM : DIAL_ICON_SIZE.MD}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                }
                /* The design's sort control is narrower than a standard button. */
                className={mergeClasses('desktop:px-3', styles.sortButton)}
              />
            </div>
          )}
        </div>

        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {getStatusMessage()}
        </LiveRegion>

        {/* The mobile bottom padding keeps the last card clear of the floating
         * button (16px inset + 40px button + 24px gap). */}
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-4 px-4 pb-20 desktop:gap-5 desktop:px-8 desktop:pt-6 desktop:pb-8">
          {isIncomplete && !isLoading && !hasError && !isFailedEmpty && (
            <div className="flex w-full max-w-[1116px] flex-wrap items-center gap-3">
              <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
                {labels.incompleteLabel}
              </p>
              <GhostButton label={labels.retryLabel} onClick={onRetry} />
            </div>
          )}
          <div
            className={mergeClasses(
              'flex w-full max-w-[1116px] min-w-0 flex-col items-center',
              isCentered && 'flex-1 justify-center',
            )}
          >
            {renderContent()}
          </div>
        </div>
      </div>

      {isMobile && onCreateProject && (
        <Button
          variant={ButtonVariant.Primary}
          iconBefore={
            <IconPlus
              size={DIAL_ICON_SIZE.LG}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={labels.createProjectLabel}
          onClick={onCreateProject}
          className="absolute inset-e-4 bottom-4 z-10 size-10 rounded-full px-0"
        />
      )}
    </div>
  );
};
