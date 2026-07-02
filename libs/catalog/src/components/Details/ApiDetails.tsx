import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
  DialNeutralButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconChevronDown, IconCopy } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CatalogItemApiDetails,
  CodeSnippet,
} from '../../models/item-details-data';
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
  /** "Endpoint" section heading for the multi-endpoint selector. Default: `'Endpoint'`. */
  endpointSectionLabel?: string;
  /** "Code snippet" section heading (legacy top-level snippets). Default: `'Code snippet'`. */
  snippetSectionLabel?: string;
  /** "Model ID" row label. Default: `'Model ID'`. */
  modelIdLabel?: string;
  /** URL row label inside each endpoint option. Default: `'Endpoint'`. */
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

interface SnippetBlockProps {
  snippets: CodeSnippet[];
  sectionLabel?: string;
  copyAriaLabel?: string;
  codeClassName?: string;
  sectionClassName?: string;
}

const SnippetBlock: FC<SnippetBlockProps> = ({
  snippets,
  sectionLabel,
  copyAriaLabel = 'Copy',
  codeClassName = 'dial-code-text',
  sectionClassName = 'dial-caption-text',
}) => {
  const [activeSnippet, setActiveSnippet] = useState<string>(
    snippets[0]?.language ?? CodeLanguage.Python,
  );

  useEffect(() => {
    setActiveSnippet(snippets[0]?.language ?? CodeLanguage.Python);
  }, [snippets]);

  const snippetItems = useMemo(
    () =>
      snippets.map((s) => ({
        key: s.language,
        label: (
          <span className="flex w-full items-center justify-between gap-2">
            {LANGUAGE_LABELS[s.language] ?? s.language}
            {s.language === activeSnippet && (
              <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
            )}
          </span>
        ),
        onClick: () => setActiveSnippet(s.language),
      })),
    [snippets, activeSnippet],
  );

  const activeLabel =
    LANGUAGE_LABELS[activeSnippet as CodeLanguage] ?? activeSnippet;
  const activeCode =
    snippets.find((s) => s.language === activeSnippet)?.code ?? '';

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(activeCode);
  }, [activeCode]);

  return (
    <section>
      {sectionLabel != null && (
        <p
          className={mergeClasses(
            'mb-3 mt-0',
            sectionClassName,
            styles.sectionHeading,
          )}
        >
          {sectionLabel}
        </p>
      )}
      <div
        className={mergeClasses(
          'overflow-hidden rounded-lg',
          styles.snippetWrapper,
        )}
      >
        <div
          className={mergeClasses(
            'flex items-center justify-end gap-2 px-3 py-[6px]',
            styles.snippetTabs,
          )}
        >
          <DialDropdown
            items={snippetItems}
            matchReferenceWidth={false}
            listClassName="cp-dropdown-overlay"
          >
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
        <div
          className={mergeClasses('relative rounded-lg p-3', styles.codeBlock)}
        >
          <pre
            className={mergeClasses(
              'm-0 overflow-x-auto pe-8',
              codeClassName,
              styles.pre,
            )}
          >
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
};

/** Renders the API tab: resource identity rows, multi-endpoint selector (models), and code snippets. */
export const ApiDetails: FC<ApiDetailsProps> = ({
  api,
  resourceSectionLabel = 'Resource',
  endpointSectionLabel = 'Endpoint',
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
  const [activeEndpointIdx, setActiveEndpointIdx] = useState(0);

  const endpoints = useMemo(() => api.endpoints ?? [], [api.endpoints]);
  const hasEndpoints = endpoints.length > 0;
  const activeEndpoint = endpoints[activeEndpointIdx] ?? null;

  const endpointDropdownItems = useMemo(
    () =>
      endpoints.map((e, i) => ({
        key: String(i),
        label: (
          <span className="flex w-full items-center justify-between gap-2">
            {e.label}
            {i === activeEndpointIdx && (
              <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
            )}
          </span>
        ),
        onClick: () => setActiveEndpointIdx(i),
      })),
    [endpoints, activeEndpointIdx],
  );

  const resourceRows: TableViewRow[] = [];
  if (api.resource?.modelId != null) {
    resourceRows.push({ label: modelIdLabel, value: api.resource.modelId });
  }
  if (api.resource?.endpointUrl != null) {
    resourceRows.push({
      label: endpointLabel,
      value: api.resource.endpointUrl,
    });
  }

  const hasResource = resourceRows.length > 0;
  const hasLegacySnippets = (api.snippets?.length ?? 0) > 0;
  const hasRequestExample = api.requestExample != null;
  const hasResponseSchema = api.responseSchema != null;

  return (
    <div className="flex flex-col gap-6">
      {hasResource && (
        <TableView
          sectionLabel={resourceSectionLabel}
          values={resourceRows}
          labelClassName={labelClassName}
          valueClassName={valueClassName}
          sectionClassName={sectionClassName}
        />
      )}

      {hasEndpoints && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p
              className={mergeClasses(
                'm-0',
                sectionClassName,
                styles.sectionHeading,
              )}
            >
              {endpointSectionLabel}
            </p>
            <DialDropdown
              items={endpointDropdownItems}
              matchReferenceWidth={false}
              listClassName="cp-dropdown-overlay"
            >
              <DialNeutralButton
                size={ElementSize.Small}
                label={activeEndpoint?.label}
                iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} />}
              />
            </DialDropdown>
          </div>

          {/* URL link + copy button */}
          {activeEndpoint != null && (
            <div
              className={mergeClasses(
                'mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5',
                styles.urlBox,
              )}
            >
              <a
                href={activeEndpoint.url}
                target="_blank"
                rel="noreferrer"
                className={mergeClasses('flex-1 break-all', codeClassName)}
              >
                {activeEndpoint.url}
              </a>
              <DialGhostIconButton
                icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
                aria-label={copyAriaLabel}
                onClick={() =>
                  void navigator.clipboard.writeText(activeEndpoint.url)
                }
              />
            </div>
          )}

          {activeEndpoint?.snippets != null &&
            activeEndpoint.snippets.length > 0 && (
              <div className="mt-4">
                <SnippetBlock
                  key={activeEndpointIdx}
                  snippets={activeEndpoint.snippets}
                  copyAriaLabel={copyAriaLabel}
                  codeClassName={codeClassName}
                  sectionClassName={sectionClassName}
                />
              </div>
            )}
        </section>
      )}

      {!hasEndpoints && hasLegacySnippets && (
        <SnippetBlock
          snippets={api.snippets!}
          sectionLabel={snippetSectionLabel}
          copyAriaLabel={copyAriaLabel}
          codeClassName={codeClassName}
          sectionClassName={sectionClassName}
        />
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
          <div
            className={mergeClasses(
              'relative rounded-lg p-3',
              styles.codeBlock,
            )}
          >
            <DialGhostIconButton
              icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
              aria-label={copyAriaLabel}
              onClick={() => {
                void navigator.clipboard.writeText(api.requestExample ?? '');
              }}
              className={mergeClasses(
                'absolute end-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded border-none p-0',
                styles.copyButton,
              )}
            />
            <pre
              className={mergeClasses(
                'm-0 overflow-x-auto pe-8',
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
          <div
            className={mergeClasses(
              'relative rounded-lg p-3',
              styles.codeBlock,
            )}
          >
            <DialGhostIconButton
              icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
              aria-label={copyAriaLabel}
              onClick={() => {
                void navigator.clipboard.writeText(api.responseSchema ?? '');
              }}
              className={mergeClasses(
                'absolute end-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded border-none p-0',
                styles.copyButton,
              )}
            />
            <pre
              className={mergeClasses(
                'm-0 overflow-x-auto pe-8',
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
