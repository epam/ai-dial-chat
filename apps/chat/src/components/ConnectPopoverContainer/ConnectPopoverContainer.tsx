import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { useCodeCopy } from '@epam/ai-dial-chat-shared';
import { NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import {
  buildApplicationMcpUrl,
  buildToolsetMcpUrl,
} from '../../utils/mcp-endpoint-url';

/** Props for `ConnectPopoverContainer`. */
interface Props {
  /** The catalog item being connected (a toolset or an MCP-capable application). */
  item: CatalogItem;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * Connect popover content: a type-specific title/description and a
 * `Copy URL` button that copies the item's MCP endpoint URL to the
 * clipboard. Renders no URL input or read-only field — the URL is never
 * shown, only copyable.
 */
const ConnectPopoverContainer: FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const { config } = useAppConfig();
  const baseUrl = config.dialCoreExternalUrl ?? '';
  const isToolset = item.type === CatalogEntityType.Toolset;
  const url = isToolset
    ? buildToolsetMcpUrl(baseUrl, item.id)
    : buildApplicationMcpUrl(baseUrl, item.id);
  const { isCopied, copy } = useCodeCopy(url);

  const title = isToolset
    ? t(CatalogI18nKeys.ConnectToolsetTitle)
    : t(CatalogI18nKeys.ConnectApplicationTitle);
  const description = isToolset
    ? t(CatalogI18nKeys.ConnectToolsetDescription)
    : t(CatalogI18nKeys.ConnectApplicationDescription);
  const copyLabel = t(ButtonsI18nKeys.Copy);
  const copiedLabel = t(ButtonsI18nKeys.Copied);

  return (
    <div className="flex w-[320px] flex-col gap-3 p-4">
      <p className="dial-body-semi-text text-start text-primary">{title}</p>
      <p className="dial-small-text text-start text-secondary">{description}</p>
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
      <span role="status" aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </div>
  );
};

export default memo(ConnectPopoverContainer);
