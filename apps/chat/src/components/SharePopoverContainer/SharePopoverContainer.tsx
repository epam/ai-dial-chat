import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { ShareLinkAccess, SharePopover } from '@epam/ai-dial-share';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { useShareLink } from '../../hooks/useShareLink/useShareLink';

/*
 * Agent-tab entities (Agent + Application, both shown under the "Agents"
 * catalog tab — see libs/catalog/src/utils/catalog-tabs.ts), Skill, and
 * Toolset support edit access. Model can only ever be shared view-only, so
 * its access control is a static label, not a dropdown.
 */
const EDITABLE_ACCESS_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Agent,
  CatalogEntityType.Application,
  CatalogEntityType.Skill,
  CatalogEntityType.Toolset,
]);

/** Props for `SharePopoverContainer`. */
interface Props {
  /** The catalog item being shared. */
  item: CatalogItem;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * Wires `useShareLink` to the host-agnostic `SharePopover` from
 * `@epam/ai-dial-share`, resolving all runtime data and i18n strings the lib
 * receives as flat props.
 */
const SharePopoverContainer: FC<Props> = ({ item, onClose }) => {
  const { t } = useTranslation();
  const { data, isLoading, error, setAccess } = useShareLink(item.id);
  const canEditAccess = EDITABLE_ACCESS_TYPES.has(item.type);

  return (
    <SharePopover
      url={data?.url}
      isLoading={isLoading}
      error={error}
      access={data?.access ?? [ShareLinkAccess.View]}
      canEditAccess={canEditAccess}
      onAccessChange={setAccess}
      onClose={onClose}
      labels={{
        title: t(ShareI18nKeys.Title),
        qrButtonLabel: t(ShareI18nKeys.QrButtonLabel),
        linkLabel: t(ButtonsI18nKeys.Link),
        anyoneWithLinkTitle: t(ShareI18nKeys.AnyoneWithLinkTitle),
        anyoneWithLinkSubtitle: t(ShareI18nKeys.AnyoneWithLinkSubtitle),
        accessAriaLabel: t(ShareI18nKeys.AccessAriaLabel),
        accessViewLabel: t(ShareI18nKeys.AccessViewLabel),
        accessEditLabel: t(ShareI18nKeys.AccessEditLabel),
        visibilityNote: t(ShareI18nKeys.VisibilityNote),
        visibilityNoteEdit: t(ShareI18nKeys.VisibilityNoteEdit),
        copyButtonLabel: t(ButtonsI18nKeys.Copy),
        copiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel),
        linkAriaLabel: t(ShareI18nKeys.LinkAriaLabel),
        expiryNote:
          data?.expiresInDays != null
            ? t(ShareI18nKeys.ExpiryNote, { days: data.expiresInDays })
            : undefined,
        qrCodeAriaLabel: t(ShareI18nKeys.QrCodeAriaLabel),
        loadingLabel: t(ShareI18nKeys.LoadingLabel),
        errorTitle: t(ShareI18nKeys.ErrorTitle),
      }}
    />
  );
};

export default memo(SharePopoverContainer);
