import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogItemTools } from '../../models/item-details-data';
import styles from './CatalogTools.module.scss';

/** Props for `CatalogTools`. */
export interface CatalogToolsProps {
  /** Tools data to render. */
  tools: CatalogItemTools;
  /** CSS class for tool name headings. Defaults to `'dial-small-semi-text'`. */
  toolNameClassName?: string;
  /** CSS class for tool descriptions. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class for table column headings. Defaults to `'dial-caption-text'`. */
  tableHeadingClassName?: string;
  /** CSS class for table cell text. Defaults to `'dial-tiny-text'`. */
  tableCellClassName?: string;
}

/** Renders the Tools tab: a list of tool definitions with input schemas and annotations. */
export const CatalogTools: FC<CatalogToolsProps> = ({
  tools,
  toolNameClassName = 'dial-small-semi-text',
  descriptionClassName = 'dial-small-text',
  tableHeadingClassName = 'dial-caption-text',
  tableCellClassName = 'dial-tiny-text',
}) => (
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
          <div className="flex flex-col gap-1.5">
            <table className={styles.table}>
              <thead>
                <tr>
                  {(['Name', 'Type', 'Required'] as const).map((h) => (
                    <th
                      key={h}
                      className={mergeClasses(
                        'px-2 py-1 text-start',
                        tableHeadingClassName,
                        styles.th,
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tool.inputParams.map((param) => (
                  <tr key={param.name} className={styles.tr}>
                    <td
                      className={mergeClasses(
                        'px-2 py-1.5',
                        tableCellClassName,
                        styles.td,
                      )}
                    >
                      <code className={styles.code}>{param.name}</code>
                    </td>
                    <td
                      className={mergeClasses(
                        'px-2 py-1.5',
                        tableCellClassName,
                        styles.td,
                      )}
                    >
                      <code className={styles.code}>{param.type}</code>
                    </td>
                    <td
                      className={mergeClasses(
                        'px-2 py-1.5',
                        tableCellClassName,
                        styles.td,
                      )}
                    >
                      {param.isRequired ? '✓' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tool.annotations != null && tool.annotations.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                {(['Key', 'Value'] as const).map((h) => (
                  <th
                    key={h}
                    className={mergeClasses(
                      'px-2 py-1 text-start',
                      tableHeadingClassName,
                      styles.th,
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tool.annotations.map((ann) => (
                <tr key={ann.key} className={styles.tr}>
                  <td
                    className={mergeClasses(
                      'px-2 py-1.5',
                      tableCellClassName,
                      styles.td,
                    )}
                  >
                    <code className={styles.code}>{ann.key}</code>
                  </td>
                  <td
                    className={mergeClasses(
                      'px-2 py-1.5',
                      tableCellClassName,
                      styles.td,
                    )}
                  >
                    {ann.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    ))}
  </div>
);
