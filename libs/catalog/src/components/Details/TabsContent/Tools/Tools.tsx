import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogItemTools } from '../../../../models/item-details-data';
import { DataGrid } from '../DataGrid/DataGrid';
import styles from './Tools.module.scss';

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
}

/** Renders the Tools tab: a list of tool definitions with input schemas and annotations. */
export const Tools: FC<ToolsProps> = ({
  tools,
  toolNameClassName = 'dial-small-semi-text',
  descriptionClassName = 'dial-small-text',
  tableHeadingClassName = 'dial-caption-text',
  tableCellClassName = 'dial-tiny-text',
}) => {
  if (tools == null) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {tools.tools.map((tool, i) => (
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
              columns={['Name', 'Type', 'Required']}
              columnsTemplate="1fr 1fr auto"
              rows={tool.inputParams.map((p) => [
                <code key="name" className={styles.code}>
                  {p.name}
                </code>,
                <code key="type" className={styles.code}>
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
              columns={['Key', 'Value']}
              rows={tool.annotations.map((ann) => [
                <code key="key" className={styles.code}>
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
