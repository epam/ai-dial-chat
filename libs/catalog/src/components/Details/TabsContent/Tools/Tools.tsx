import { mergeClasses, PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { Search } from '@epam/ai-dial-ui-kit';
import { FC, useMemo, useState } from 'react';
import type {
  CatalogItemTools,
  ToolDefinition,
  ToolsLabels,
} from '../../../../models/item-details-data';
import { DataGrid } from '../DataGrid/DataGrid';
import styles from './Tools.module.scss';

const DEFAULT_TOOLS_LABELS: ToolsLabels = {
  inputName: 'Name',
  inputType: 'Type',
  inputRequired: 'Required',
  annotationKey: 'Key',
  annotationValue: 'Value',
  searchPlaceholder: 'Search...',
  searchClearLabel: 'Clear search',
  toolCount: (count) => `${count} tools`,
  noResults: 'No results found',
};

// A tool matches when its name or description contains the query, ignoring case.
const matchesQuery = (tool: ToolDefinition, query: string): boolean =>
  tool.name.toLowerCase().includes(query) ||
  (tool.description?.toLowerCase().includes(query) ?? false);

/** Props for `Tools`. */
export interface ToolsProps {
  /** Tools data to render. */
  tools?: CatalogItemTools;
  /** CSS class for tool name headings. Defaults to `'dial-small-semi-text'`. */
  toolNameClassName?: string;
  /** CSS class for tool descriptions. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class for grid column headings. Defaults to `'dial-caption-text'`. */
  tableHeadingClassName?: string;
  /** CSS class for grid cell text. Defaults to `'dial-tiny-text'`. */
  tableCellClassName?: string;
  /** CSS class for the tool count above the list. Defaults to `'dial-tiny-text'`. */
  countClassName?: string;
  /** Grid column headings, search, count and no-results strings, merged over English defaults. */
  labels?: Partial<ToolsLabels>;
}

/**
 * Renders the Tools tab: a search field, the number of tools shown, and the
 * list of tool definitions with input schemas and annotations.
 */
export const Tools: FC<ToolsProps> = ({
  tools,
  toolNameClassName = 'dial-small-semi-text',
  descriptionClassName = 'dial-small-text',
  tableHeadingClassName = 'dial-caption-text',
  tableCellClassName = 'dial-tiny-text',
  countClassName = 'dial-tiny-text',
  labels,
}) => {
  const columnLabels = { ...DEFAULT_TOOLS_LABELS, ...labels };
  const [query, setQuery] = useState('');

  const shownTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const all = tools?.tools ?? [];
    return normalizedQuery === ''
      ? all
      : all.filter((tool) => matchesQuery(tool, normalizedQuery));
  }, [tools, query]);

  if (tools == null) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 pb-2 pt-4">
        <Search
          value={query}
          placeholder={columnLabels.searchPlaceholder}
          aria-label={columnLabels.searchPlaceholder}
          clearLabel={columnLabels.searchClearLabel}
          onChange={(value) => setQuery(value ?? '')}
        />
        {/* Polite, so the count is announced as the search narrows the list. */}
        <span
          role="status"
          aria-live="polite"
          className={mergeClasses(countClassName, styles.count)}
        >
          {columnLabels.toolCount(shownTools.length)}
        </span>
      </div>

      {shownTools.length === 0 && query.trim() !== '' && (
        <PanelEmptyState label={columnLabels.noResults} />
      )}

      {shownTools.map((tool, i) => (
        <div
          key={tool.name}
          className={mergeClasses(
            'flex flex-col gap-3 px-[22px] py-4',
            i > 0 ? styles.divider : undefined,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className={toolNameClassName}>{tool.name}</span>
            {tool.description != null && (
              <p
                className={mergeClasses(
                  'm-0',
                  descriptionClassName,
                  styles.description,
                )}
              >
                {tool.description}
              </p>
            )}
          </div>

          {tool.inputParams != null && tool.inputParams.length > 0 && (
            <DataGrid
              columns={[
                columnLabels.inputName,
                columnLabels.inputType,
                columnLabels.inputRequired,
              ]}
              columnsTemplate="1fr 1fr auto"
              rows={tool.inputParams.map((p) => [
                <code
                  key="name"
                  className={mergeClasses(
                    'text-inherit border-none bg-transparent p-0',
                    styles.code,
                  )}
                >
                  {p.name}
                </code>,
                <code
                  key="type"
                  className={mergeClasses(
                    'text-inherit border-none bg-transparent p-0',
                    styles.code,
                  )}
                >
                  {p.type}
                </code>,
                p.isRequired ? '✓' : '—',
              ])}
              headingClassName={tableHeadingClassName}
              cellClassName={tableCellClassName}
            />
          )}

          {tool.annotations != null && tool.annotations.length > 0 && (
            <DataGrid
              columns={[
                columnLabels.annotationKey,
                columnLabels.annotationValue,
              ]}
              rows={tool.annotations.map((ann) => [
                <code
                  key="key"
                  className={mergeClasses(
                    'text-inherit border-none bg-transparent p-0',
                    styles.code,
                  )}
                >
                  {ann.key}
                </code>,
                ann.value,
              ])}
              headingClassName={tableHeadingClassName}
              cellClassName={tableCellClassName}
            />
          )}
        </div>
      ))}
    </div>
  );
};
