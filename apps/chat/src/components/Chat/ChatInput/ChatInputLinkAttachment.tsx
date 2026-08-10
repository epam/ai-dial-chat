import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isSafeLinkUrl } from '@/src/utils/app/file';

import { DialLink } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { Tooltip } from '@/src/components/Common/Tooltip';

import LinkIcon from '@/public/images/icons/arrow-up-right-from-square.svg';

interface Props {
  link: DialLink;

  onUnselect?: () => void;
}

export const ChatInputLinkAttachment = ({ link, onUnselect }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const name = link.title || link.href;
  // Only a url we can safely put into an href stays clickable, the rest of the
  // card renders the same way either way.
  const href = isSafeLinkUrl(link.href) ? link.href : undefined;

  const nameClassName =
    'block max-w-full truncate whitespace-pre text-start text-sm';

  return (
    <div
      className="flex items-center gap-3 rounded border border-primary bg-layer-1 px-3 py-2"
      data-qa="chat-attachment"
    >
      {href ? (
        <Tooltip tooltip={t(ChatI18nKeys.OpenLink)}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-icon-button-small"
            aria-label={t(ChatI18nKeys.OpenLink)}
          >
            <LinkIcon
              height={DEFAULT_ICON_SIZES.SMALL}
              width={DEFAULT_ICON_SIZES.SMALL}
            />
          </a>
        </Tooltip>
      ) : (
        <LinkIcon
          height={DEFAULT_ICON_SIZES.SMALL}
          width={DEFAULT_ICON_SIZES.SMALL}
          className="shrink-0 text-secondary"
        />
      )}

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <Tooltip
          tooltip={name}
          triggerClassName="truncate text-center flex-1 min-w-0 min-h-0"
        >
          <div className="flex grow flex-col overflow-hidden text-sm">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={classNames(
                  nameClassName,
                  'hover:text-accent-primary',
                )}
                data-qa="attachment-name"
              >
                {name}
              </a>
            ) : (
              <span className={nameClassName} data-qa="attachment-name">
                {name}
              </span>
            )}
          </div>
        </Tooltip>

        {onUnselect && (
          <div className="flex gap-3">
            <CloseButtonSmall onClick={() => onUnselect()} />
          </div>
        )}
      </div>
    </div>
  );
};
