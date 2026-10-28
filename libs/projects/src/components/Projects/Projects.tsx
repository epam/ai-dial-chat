import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import {
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
import { FC, useMemo } from 'react';
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
  searchQuery,
  onSearchQueryChange,
  sortKey,
  onSortKeyChange,
  formatUpdatedAt,
  labels,
  locale,
  styles: projectsStyles,
}) => {
  const { colors, typography } = projectsStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const subtitleClassName = typography?.subtitleClassName ?? 'dial-body-text';
  const cardTitleClassName =
    typography?.cardTitleClassName ?? 'dial-body-semi-text';
  const badgeClassName = typography?.badgeClassName ?? 'dial-tiny-semi-text';
  const metaClassName = typography?.metaClassName ?? 'dial-small-text';
  const cssVars = buildCssVars({
    '--pr-bg': colors?.background,
    '--pr-subtitle-text': colors?.subtitleText,
    '--pr-sort-text': colors?.sortButtonText,
    '--pr-card-bg': colors?.cardBackground,
    '--pr-card-border': colors?.cardBorder,
    '--pr-card-title-text': colors?.cardTitleText,
    '--pr-badge-bg': colors?.badgeBackground,
    '--pr-badge-text': colors?.badgeText,
    '--pr-meta-text': colors?.metaText,
  });

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
      return (
        <PanelEmptyState
          label={labels.emptyStateLabel}
          description={labels.emptyStateDescription}
        />
      );
    }

    if (visibleProjects.length === 0) {
      return <PanelEmptyState label={labels.noResultsLabel} />;
    }

    return (
      <ul className="m-0 grid w-full min-w-0 list-none grid-cols-1 gap-4 p-0 desktop:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            searchQuery={trimmedQuery}
            sourceLabel={labels.sourceLabels[project.source]}
            formatUpdatedAt={formatUpdatedAt}
            titleClassName={cardTitleClassName}
            badgeClassName={badgeClassName}
            metaClassName={metaClassName}
          />
        ))}
      </ul>
    );
  };

  const isCentered = isLoading || hasError || visibleProjects.length === 0;

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full min-w-0 flex-col gap-4 overflow-y-auto px-4 py-4 desktop:gap-6 desktop:px-8',
        styles.container,
      )}
    >
      <div className="min-w-0">
        <h1 className={mergeClasses('break-words', titleClassName)}>
          {labels.title}
        </h1>
        <p className={mergeClasses('mt-1', subtitleClassName, styles.subtitle)}>
          {labels.subtitle}
        </p>
      </div>

      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center">
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

      {isIncomplete && !isLoading && !hasError && !isFailedEmpty && (
        <div className="flex flex-wrap items-center gap-3">
          <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
            {labels.incompleteLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      )}

      <div
        className={mergeClasses(
          'flex w-full min-w-0 flex-1 flex-col',
          isCentered && 'items-center justify-center',
        )}
      >
        {renderContent()}
      </div>
    </div>
  );
};
