import { CopyButton, mergeClasses, useCodeCopy } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';
import type { ConnectMcpUrlContentLabels } from '../../models/settings-form-props';

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
        <p className="dial-body-semi-text text-start text-primary">
          {labels?.title ?? 'Connect toolset'}
        </p>
        <p className="dial-small-text text-start text-secondary">
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
      <span role="status" aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </div>
  );
};

export default memo(ConnectMcpUrlContent);
