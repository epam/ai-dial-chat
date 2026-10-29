import {
  CopyButton,
  mergeClasses,
  useCodeCopy,
} from '@epam/ai-dial-chat-shared';
import { LiveRegion, LiveRegionElement } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import type { ConnectMcpUrlContentLabels } from '../../models/settings-form-props';
import styles from './ConnectMcpUrlContent.module.scss';

interface ConnectMcpUrlContentProps {
  /** MCP endpoint URL shown and copied. */
  url: string;
  /** CSS class applied to the root. */
  className?: string;
  /** Pre-translated labels, all optional with English defaults. */
  labels?: ConnectMcpUrlContentLabels;
}

/** "Connect toolset" block: title, description, and a Copy URL button with `aria-live` copied feedback. */
const ConnectMcpUrlContent: FC<ConnectMcpUrlContentProps> = ({
  url,
  className,
  labels,
}) => {
  const { isCopied, copy } = useCodeCopy(url);

  const copiedLabel = labels?.copiedLabel ?? 'Copied!';

  return (
    <div className={mergeClasses('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <p
          className={mergeClasses(
            'dial-body-semi-text text-start',
            styles.title,
          )}
        >
          {labels?.title ?? 'Connect toolset'}
        </p>
        <p
          className={mergeClasses(
            'dial-small-text text-start',
            styles.description,
          )}
        >
          {labels?.description ??
            'Copy endpoint URL to easily integrate toolset into your workflows'}
        </p>
      </div>
      <div>
        <CopyButton
          copiedLabel={copiedLabel}
          copyLabel={labels?.copyLabel ?? 'Copy URL'}
          isCopied={isCopied}
          onClick={copy}
        />
      </div>
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isCopied ? copiedLabel : ''}
      </LiveRegion>
    </div>
  );
};

export default memo(ConnectMcpUrlContent);
