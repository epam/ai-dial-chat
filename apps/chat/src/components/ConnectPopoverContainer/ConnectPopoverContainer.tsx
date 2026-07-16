import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { FC, memo } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import {
  buildApplicationMcpUrl,
  buildToolsetMcpUrl,
} from '../../utils/mcp-endpoint-url';
import ConnectMcpUrlContent from '../ConnectMcpUrlContent/ConnectMcpUrlContent';

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
  const { config } = useAppConfig();
  const baseUrl = config.dialCoreExternalUrl ?? '';
  const isToolset = item.type === CatalogEntityType.Toolset;
  const url = isToolset
    ? buildToolsetMcpUrl(baseUrl, item.id)
    : buildApplicationMcpUrl(baseUrl, item.id);

  return (
    <ConnectMcpUrlContent
      entityType={item.type}
      url={url}
      className="w-[320px] p-4"
    />
  );
};

export default memo(ConnectPopoverContainer);
