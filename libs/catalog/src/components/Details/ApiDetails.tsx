import { MarkdownCodeBlock, mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, InlineSelect } from '@epam/ai-dial-ui-kit';
import { FC, useEffect, useMemo, useState } from 'react';
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

/** Maps this lib's `CodeLanguage` values to the syntax-highlighter language ids `MarkdownCodeBlock` expects. */
const SYNTAX_LANGUAGES: Record<CodeLanguage, string> = {
  [CodeLanguage.Python]: 'python',
  [CodeLanguage.Curl]: 'bash',
  [CodeLanguage.JavaScript]: 'javascript',
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
  /** Title shown in the single-endpoint code block's header (when `api.endpoints` is absent). Default: `'Endpoint'`. */
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
        label: LANGUAGE_LABELS[s.language] ?? s.language,
        onClick: () => setActiveSnippet(s.language),
      })),
    [snippets],
  );

  const activeCode =
    snippets.find((s) => s.language === activeSnippet)?.code ?? '';

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
      <MarkdownCodeBlock
        language={
          SYNTAX_LANGUAGES[activeSnippet as CodeLanguage] ?? activeSnippet
        }
        value={activeCode}
        copyLabel={copyAriaLabel}
        codeClassName={codeClassName}
        hideDownload
        titleSlot={
          <InlineSelect
            items={snippetItems}
            matchReferenceWidth={false}
            placement="bottom-end"
            size={ElementSize.Small}
            selectedKey={activeSnippet}
            listClassName="cp-dropdown-overlay"
          />
        }
      />
    </section>
  );
};

/** Renders the Connect tab: resource identity rows, a copyable single- or multi-endpoint URL (titled with the endpoint's name), and code snippets. */
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

  const endpointItems = useMemo(
    () =>
      endpoints.map((e, i) => ({
        key: e.url,
        label: e.label,
        onClick: () => setActiveEndpointIdx(i),
      })),
    [endpoints],
  );

  const resourceRows: TableViewRow[] = [];
  if (api.resource?.modelId != null) {
    resourceRows.push({ label: modelIdLabel, value: api.resource.modelId });
  }

  const hasResource = resourceRows.length > 0;
  // Only one of the multi-endpoint selector or this single-endpoint box ever
  // applies to a given item; guarded here in case a caller supplies both.
  const singleEndpointUrl = !hasEndpoints ? api.resource?.endpointUrl : null;
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

      {singleEndpointUrl != null && (
        <MarkdownCodeBlock
          language={endpointLabel}
          value={singleEndpointUrl}
          copyLabel={copyAriaLabel}
          codeClassName={codeClassName}
          hideDownload
        />
      )}

      {hasEndpoints && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {endpointSectionLabel}
          </p>

          {activeEndpoint != null && (
            <MarkdownCodeBlock
              key={activeEndpointIdx}
              language={activeEndpoint.label}
              value={activeEndpoint.url}
              copyLabel={copyAriaLabel}
              codeClassName={codeClassName}
              hideDownload
              titleSlot={
                <InlineSelect
                  items={endpointItems}
                  matchReferenceWidth={false}
                  placement="bottom-end"
                  size={ElementSize.Small}
                  selectedKey={activeEndpoint.url}
                  listClassName="cp-dropdown-overlay"
                />
              }
            />
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
          snippets={api.snippets ?? []}
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
          <MarkdownCodeBlock
            language="bash"
            value={api.requestExample ?? ''}
            copyLabel={copyAriaLabel}
            codeClassName={codeClassName}
            hideDownload
          />
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
          <MarkdownCodeBlock
            language="json"
            value={api.responseSchema ?? ''}
            copyLabel={copyAriaLabel}
            codeClassName={codeClassName}
            hideDownload
          />
        </section>
      )}
    </div>
  );
};
