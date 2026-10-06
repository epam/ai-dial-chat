import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  Input,
  LinkButton,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconKey } from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import type { CatalogItem } from '../../../../models/catalog-item';
import type {
  ItemDetailsColors,
  ItemDetailsTexts,
} from '../../../../models/item-details-props';
import {
  CredentialsLevel,
  CredentialStatus,
} from '../../../../types/toolset-auth';
import { CredentialsInfoCard } from '../../Credentials/CredentialsInfoCard/CredentialsInfoCard';
import styles from './CredentialsApiKeyOverlay.module.scss';

const SPINNER_SIZE = 16;

/** Props for {@link CredentialsApiKeyOverlay}. */
interface CredentialsApiKeyOverlayProps {
  /** Item the popover manages the API key for. */
  item: CatalogItem;
  /** Credentials slot this popover manages. Always `User` — this is the personal, non-admin API-key popover. */
  level: CredentialsLevel;
  /** Current sign-in status of the personal API key. */
  status: CredentialStatus | undefined;
  /** Already-formatted relative time since the key was added (e.g. `'3 weeks ago'`), shown as support text once signed in. */
  apiKeyAddedWhen?: string;
  /** Name of the configured API key header (e.g. `X-Api-Key`). When set, a hint naming it is shown under, and describes, the API key input. */
  apiKeyHeader?: string;
  /** Called with the entered key when "Add" is submitted. May return a promise; the popover stays open with a spinner until it resolves. */
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /** Called when "Delete" is clicked to remove the key on file. May return a promise; the popover stays open with a spinner until it resolves. */
  onLogout?: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void> | void;
  /** Called once the login/logout call resolves successfully, so the anchoring dropdown can close. */
  onClose: () => void;
  /** Text overrides. */
  texts?: ItemDetailsTexts;
  /**
   * Color overrides. The popover renders in a portal, outside the details
   * panel, so it sets the vars it reads on its own root.
   */
  colors?: ItemDetailsColors;
  /** CSS class applied to the "Delete" action. Defaults to `'text-error'`. */
  deleteActionClassName?: string;
}

/** Popover content for the header's "API key"/"Change API key" trigger: add a personal key, or confirm and remove the one already on file. */
export const CredentialsApiKeyOverlay: FC<CredentialsApiKeyOverlayProps> = ({
  item,
  level,
  status,
  apiKeyAddedWhen,
  apiKeyHeader,
  onLogin,
  onLogout,
  onClose,
  texts,
  colors,
  deleteActionClassName = 'text-error',
}) => {
  const [apiKey, setApiKey] = useState('');
  const [hasEmptyKeyError, setHasEmptyKeyError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSignedIn = status === CredentialStatus.SignedIn;

  const handleApiKeyChange = useCallback((value?: string) => {
    setApiKey(value ?? '');
    setHasEmptyKeyError(false);
  }, []);

  const handleAdd = useCallback(async () => {
    if (apiKey.trim().length === 0) {
      setHasEmptyKeyError(true);
      return;
    }
    setIsSaving(true);
    try {
      await onLogin?.(item, { level, apiKey });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [item, level, apiKey, onLogin, onClose]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onLogout?.(item, { level });
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }, [item, level, onLogout, onClose]);

  const title = texts?.personalApiKeyPanelTitle ?? 'Personal API key';
  const addLabel = texts?.addApiKeyActionLabel ?? 'Add';
  const deleteLabel = texts?.deleteActionLabel ?? 'Delete';
  const addingStatusLabel = texts?.addingApiKeyStatusLabel ?? 'Adding';
  const deletingStatusLabel = texts?.deletingStatusLabel ?? 'Deleting';
  const emptyKeyErrorMessage =
    texts?.apiKeyRequiredErrorMessage ?? 'API key is required.';
  const addedMessage =
    texts?.personalApiKeyAddedMessage ?? 'Personal key has been added';
  const inputId = `catalog-item-${item.id}-${level}-api-key`;
  const headerHintId = `${inputId}-header-hint`;
  const headerHint = apiKeyHeader
    ? (
        texts?.apiKeyHeaderHint ??
        ((header) => `Enter your API key value for "${header}" header`)
      )(apiKeyHeader)
    : undefined;
  const addedWhenLabel =
    apiKeyAddedWhen != null
      ? (texts?.apiKeyAddedLabel ?? ((when) => `Added ${when}`))(
          apiKeyAddedWhen,
        )
      : undefined;

  const cssVars = buildCssVars({
    '--cat-details-divider': colors?.divider,
    '--cat-cred-hint-text': colors?.credentialsHintText,
    '--cat-cred-card-bg': colors?.credentialsCardBackground,
    '--cat-cred-card-icon': colors?.credentialsCardIcon,
    '--cat-cred-card-title-text': colors?.credentialsCardTitleText,
    '--cat-cred-card-description-text': colors?.credentialsCardDescriptionText,
  });

  return (
    <div className="flex w-[418px] flex-col" style={cssVars}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="dial-small-semi-text">{title}</span>
      </div>
      <div className={mergeClasses('mx-4 h-px', styles.divider)} />

      {!isSignedIn && (
        <div className="flex animate-fadeIn flex-col gap-1 px-4 py-3.5">
          <div className="flex items-end gap-2">
            <Input
              id={inputId}
              aria-describedby={headerHint ? headerHintId : undefined}
              type="password"
              autoComplete="current-password"
              value={apiKey}
              onChange={handleApiKeyChange}
              labelProps={{ label: texts?.apiKeyFieldLabel ?? 'API key' }}
              invalid={hasEmptyKeyError}
              disabled={isSaving}
              containerClassName="min-w-0 flex-1"
            />
            <NeutralButton
              label={isSaving ? undefined : addLabel}
              aria-label={isSaving ? addingStatusLabel : undefined}
              iconBefore={
                isSaving ? (
                  <Spinner size={SPINNER_SIZE} ariaLabel={addingStatusLabel} />
                ) : undefined
              }
              onClick={handleAdd}
              disabled={isSaving}
            />
          </div>
          {/*
           * The header hint and the error are rendered as siblings below the
           * input+button row, not through Input's own `caption`/`error` props,
           * so the button never shifts when they appear — only the space below
           * the row grows. Input's `caption` also carries no id to describe the
           * field by and is announced as an alert; this hint is static.
           */}
          {headerHint && (
            <span
              id={headerHintId}
              className={mergeClasses('dial-caption-text', styles.hint)}
            >
              {headerHint}
            </span>
          )}
          {hasEmptyKeyError && (
            <span className="dial-caption-text text-error">
              {emptyKeyErrorMessage}
            </span>
          )}
        </div>
      )}

      {isSignedIn && (
        <div className="animate-fadeIn px-4 py-3.5">
          <CredentialsInfoCard
            icon={
              <IconKey size={20} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
            }
            title={addedMessage}
            description={addedWhenLabel}
            action={
              <LinkButton
                label={isDeleting ? undefined : deleteLabel}
                aria-label={isDeleting ? deletingStatusLabel : undefined}
                iconBefore={
                  isDeleting ? (
                    <Spinner
                      size={SPINNER_SIZE}
                      ariaLabel={deletingStatusLabel}
                    />
                  ) : undefined
                }
                className={deleteActionClassName}
                onClick={handleDelete}
                disabled={isDeleting}
              />
            }
          />
        </div>
      )}
    </div>
  );
};
