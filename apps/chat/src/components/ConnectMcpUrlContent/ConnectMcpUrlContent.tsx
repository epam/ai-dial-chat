import {
  CatalogEntityType,
  CopyButton,
  mergeClasses,
  useCodeCopy,
} from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
interface Props {
  entityType: CatalogEntityType;
  url: string;
  className?: string;
  copyLabelKey?: ButtonsI18nKeys;
}

const ConnectMcpUrlContent: FC<Props> = ({
  entityType,
  url,
  className,
  copyLabelKey = ButtonsI18nKeys.Copy,
}) => {
  const { t } = useTranslation();
  const { isCopied, copy } = useCodeCopy(url);
  const isToolset = entityType === CatalogEntityType.Toolset;

  const title = isToolset
    ? t(CatalogI18nKeys.ConnectToolsetTitle)
    : t(CatalogI18nKeys.ConnectApplicationTitle);
  const description = isToolset
    ? t(CatalogI18nKeys.ConnectToolsetDescription)
    : t(CatalogI18nKeys.ConnectApplicationDescription);
  const copyLabel = t(copyLabelKey);
  const copiedLabel = t(ButtonsI18nKeys.Copied);

  return (
    <div className={mergeClasses('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <p className="dial-body-semi-text text-start text-primary">{title}</p>
        <p className="dial-small-text text-start text-secondary">
          {description}
        </p>
      </div>
      <div>
        <CopyButton
          copiedLabel={copiedLabel}
          copyLabel={copyLabel}
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
