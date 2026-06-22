import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
  DialNeutralButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconCopy } from '@tabler/icons-react';
import { FC, useCallback, useMemo, useState } from 'react';
import type { CatalogItemApiDetails } from '../../models/item-details-data';
import { CodeLanguage } from '../../types/code-language';
import { TableView, type TableViewRow } from '../TableView/TableView';
import styles from './CatalogApiDetails.module.scss';

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  [CodeLanguage.Python]: 'Python',
  [CodeLanguage.Curl]: 'cURL',
  [CodeLanguage.JavaScript]: 'JavaScript',
};

/** Props for `ApiDetails`. */
export interface ApiDetailsProps {
  /** API detail data to render. */
  api: CatalogItemApiDetails;
  /** "Resource" section heading. Default: `'Resource'`. */
  resourceSectionLabel?: string;
  /** "Code snippet" section heading. Default: `'Code snippet'`. */
  snippetSectionLabel?: string;
  /** "Model ID" row label. Default: `'Model ID'`. */
  modelIdLabel?: string;
  /** "Endpoint" row label. Default: `'Endpoint'`. */
  endpointLabel?: string;
  /** "Request example" row label. Default: `'Request example'`. */
  requestExampleLabel?: string;
  /** "Response schema" row label. Default: `'Response schema'`. */
  responseSchemaLabel?: string;
  /** Accessible label for the copy button. Default: `'Copy'`. */
  copyAriaLabel?: string;
  /** CSS class for row labels. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for row values. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
  /** CSS class for code block text. Defaults to `'dial-code-text'`. */
  codeClassName?: string;
  /** CSS class for section headings. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
}

/** Renders the API tab: resource identity rows and multi-language code snippets. */
export const ApiDetails: FC<ApiDetailsProps> = ({
  api,
  resourceSectionLabel = 'Resource',
  snippetSectionLabel = 'Code snippet',
  modelIdLabel = 'Model ID',
  endpointLabel = 'Endpoint',
  requestExampleLabel = 'Request example',
  responseSchemaLabel = 'Response schema',
  copyAriaLabel = 'Copy',
  labelClassName = 'dial-small-semi-text',
  valueClassName = 'dial-small-text',
  codeClassName = 'dial-code-text',
  sectionClassName = 'dial-caption-text',
}) => {
  const [activeSnippet, setActiveSnippet] = useState<string>(
    api.snippets?.[0]?.language ?? CodeLanguage.Python,
  );

  const snippetItems = useMemo(
    () =>
      (api.snippets ?? []).map((s) => ({
        key: s.language,
        label: LANGUAGE_LABELS[s.language] ?? s.language,
        onClick: () => setActiveSnippet(s.language),
      })),
    [api.snippets],
  );

  const activeLabel =
    LANGUAGE_LABELS[activeSnippet as CodeLanguage] ?? activeSnippet;

  const activeCode =
    api.snippets?.find((s) => s.language === activeSnippet)?.code ?? '';

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(activeCode);
  }, [activeCode]);

  const resourceValues: TableViewRow[] = [];
  if (api.resource?.modelId != null) {
    resourceValues.push({ label: modelIdLabel, value: api.resource.modelId });
  }
  if (api.resource?.endpointUrl != null) {
    resourceValues.push({
      label: endpointLabel,
      value: api.resource.endpointUrl,
    });
  }

  const hasResource = resourceValues.length > 0;
  const hasSnippets = snippetItems.length > 0;
  const hasRequestExample = api.requestExample != null;
  const hasResponseSchema = api.responseSchema != null;

  return (
    <div className="flex flex-col gap-6">
      {hasResource && (
        <TableView
          sectionLabel={resourceSectionLabel}
          values={resourceValues}
          labelClassName={labelClassName}
          valueClassName={valueClassName}
          sectionClassName={sectionClassName}
        />
      )}

      {hasSnippets && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {snippetSectionLabel}
          </p>
          <div className={mergeClasses(styles.snippetWrapper)}>
            <div
              className={mergeClasses(
                styles.snippetTabs,
                'flex items-center justify-between',
              )}
            >
              <DialDropdown items={snippetItems}>
                <DialNeutralButton
                  size={ElementSize.Small}
                  label={activeLabel}
                  iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} />}
                />
              </DialDropdown>
              <DialGhostIconButton
                icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
                aria-label={copyAriaLabel}
                onClick={handleCopy}
              />
            </div>
            <div className={styles.codeBlock}>
              <pre
                className={mergeClasses(
                  'm-0 overflow-x-auto',
                  codeClassName,
                  styles.pre,
                )}
              >
                <code>{activeCode}</code>
              </pre>
            </div>
          </div>
        </section>
      )}

      {hasRequestExample && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {requestExampleLabel}
          </p>
          <div className={styles.codeBlock}>
            <DialGhostIconButton
              icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
              aria-label={copyAriaLabel}
              onClick={() => {
                void navigator.clipboard.writeText(api.requestExample ?? '');
              }}
              className={styles.copyButton}
            />
            <pre
              className={mergeClasses(
                'm-0 overflow-x-auto',
                codeClassName,
                styles.pre,
              )}
            >
              <code>{api.requestExample}</code>
            </pre>
          </div>
        </section>
      )}

      {hasResponseSchema && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {responseSchemaLabel}
          </p>
          <div className={styles.codeBlock}>
            <DialGhostIconButton
              icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
              aria-label={copyAriaLabel}
              onClick={() => {
                void navigator.clipboard.writeText(api.responseSchema ?? '');
              }}
              className={styles.copyButton}
            />
            <pre
              className={mergeClasses(
                'm-0 overflow-x-auto',
                codeClassName,
                styles.pre,
              )}
            >
              <code>{api.responseSchema}</code>
            </pre>
          </div>
        </section>
      )}
    </div>
  );
};
