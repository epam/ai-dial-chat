import { CatalogEntityType } from '@epam/ai-dial-catalog';
import { mergeClasses, useCodeCopy } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, NeutralButton } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
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
        <NeutralButton
          label={isCopied ? copiedLabel : copyLabel}
          iconBefore={
            isCopied ? (
              <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
            ) : (
              <IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />
            )
          }
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
