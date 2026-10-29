import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
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
} from '@epam/ai-dial-ui-kit';
import { IconArrowsSort } from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import type { ProjectsProps } from '../../models/projects-props';
import type { ProjectsSortKey } from '../../types/projects-sort-key';
import { filterProjects, sortProjects } from '../../utils/projects';
import { ProjectCard } from '../ProjectCard/ProjectCard';
import styles from './Projects.module.scss';

/** Projects page shell: header, search + sort toolbar, and a loading, error, empty, no-results or card-grid state. */
export const Projects: FC<ProjectsProps> = ({
  projects,
  isLoading = false,
  hasError = false,
  incompleteSources = [],
  onRetry,
  onCreateProject,
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
  const titleClassName = typography?.titleClassName ?? 'dial-h2-text';
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
  });

  /* Fixed at mount: the relative times are a snapshot of the page visit. */
  const [now] = useState(() => Date.now());
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
          containerClassName="p-3"
          labelClassName="mt-3"
          descriptionClassName={emptyStateDescriptionClassName}
        />
      );
    }

    if (visibleProjects.length === 0) {
      return (
        <PanelEmptyState
          label={labels.noResultsLabel}
          containerClassName="p-3"
          labelClassName="mt-3"
        />
      );
    }

    return (
      <ul className="m-0 grid w-full min-w-0 list-none grid-cols-1 gap-5 p-0 desktop:grid-cols-3">
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            searchQuery={trimmedQuery}
            sourceLabel={labels.sourceLabels[project.source]}
            folderPathLabel={labels.folderPathLabel}
            pinnedLabel={labels.pinnedLabel ?? 'Pinned'}
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

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full min-w-0 flex-col overflow-y-auto',
        styles.container,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 px-4 py-4 desktop:px-8">
        <div className="min-w-0 flex-1">
          <h1 className={mergeClasses('break-words', titleClassName)}>
            {labels.title}
          </h1>
          {labels.subtitle && (
            <p
              className={mergeClasses(
                'mt-0.5',
                subtitleClassName,
                styles.subtitle,
              )}
            >
              {labels.subtitle}
            </p>
          )}
        </div>
        {renderCreateButton(ButtonVariant.Primary)}
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4 pb-5 desktop:flex-row desktop:items-center desktop:px-8">
        <div role="search" className="min-w-0 flex-1">
          <Search
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={labels.searchPlaceholder}
            clearLabel={labels.clearSearchLabel}
            aria-label={labels.searchAriaLabel}
            size={ElementSize.Large}
          />
        </div>
        {labels.sortOptions.length > 0 && (
          <div role="group" aria-label={labels.sortLabel} className="shrink-0">
            <ButtonDropdown
              items={sortItems}
              label={activeSortLabel}
              variant={ButtonVariant.Primary}
              appearance={ButtonAppearance.Ghost}
              iconBefore={
                <IconArrowsSort
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              className={styles.sortButton}
            />
          </div>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {getStatusMessage()}
      </span>

      <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-5 px-4 pt-6 pb-8 desktop:px-8">
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
  );
};
