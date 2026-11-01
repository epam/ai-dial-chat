import {
  buildCssVars,
  DeploymentIcon,
  ItemHeader,
} from '@epam/ai-dial-chat-shared';
import {
  Breadcrumbs,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DialItemType,
  ElementSize,
  FileIcon,
  GhostIconButton,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import { IconTrash } from '@tabler/icons-react';
import { type FC, type ReactNode, useId } from 'react';
import type { CatalogItemCredentials } from '../../models/catalog-item-credentials';
import { CredentialsBadge } from '../CredentialsBadge/CredentialsBadge';
import styles from './AddOnListItem.module.scss';

/** User-visible strings of `AddOnListItem`; pass translated ones in a localised host. */
export interface AddOnListItemLabels {
  /** Accessible name of the remove button. Defaults to `` `Remove ${name}` ``. */
  remove?: string;
  /** Accessible name of the location trail. Defaults to `'Location'`. */
  location?: string;
  /** Label and tooltip of the logged-out badge. Defaults to `CredentialsBadge`'s own. */
  credentialsBadge?: string;
}

/** Color overrides for `AddOnListItem`, applied as CSS custom properties. */
export interface AddOnListItemColors {
  /** Row background on hover. Defaults to `--bg-control-accent-alpha`. */
  rowHoverBackground?: string;
  /** Outline color of the focused row button. Defaults to `--stroke-accent-focus`. */
  focusOutline?: string;
  /** Color of the name. Defaults to `--text-primary`. */
  title?: string;
  /** Color of the version. Defaults to `--text-secondary`. */
  version?: string;
  /** Color of the line under the name. Defaults to `--text-secondary`. */
  description?: string;
}

/** Props for `AddOnListItem`. */
export interface AddOnListItemProps {
  /** The item's display name; also names the row's button. */
  name: string;
  /** Version shown after the name. */
  version?: string;
  /** Already-resolved icon URL; without it the avatar shows the name's initials. */
  iconUrl?: string;
  /** Draws a `FileIcon` of this type instead of the avatar. */
  fileType?: DialItemType;
  /** Avatar size in px. Defaults to `36`. */
  iconSize?: number;
  /** The item's location, outermost first; shown as plain breadcrumbs in place of the name. */
  path?: string[];
  /** The line under the name, e.g. a status or the item's source; describes the row's button. */
  description?: ReactNode;
  /** Content after the text, e.g. status badges. */
  trailing?: ReactNode;
  /** Credentials of the item; a signed-out state draws the logged-out badge over the icon. */
  credentials?: CatalogItemCredentials;
  /** User-visible strings. */
  labels?: AddOnListItemLabels;
  /** Color overrides, applied as CSS custom properties. */
  colors?: AddOnListItemColors;
  /** CSS class applied to the name. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the version. Defaults to `'dial-tiny-text'`. */
  versionClassName?: string;
  /** CSS class applied to the line under the name. Defaults to `'dial-tiny-text'`. */
  descriptionClassName?: string;
  /** Disables the row's buttons. Defaults to `false`. */
  isDisabled?: boolean;
  /** Called when the row is activated. */
  onOpen: () => void;
  /** Called by the remove button; without it there is none. */
  onRemove?: () => void;
}

const ROW_CLASS =
  'group relative flex min-w-0 items-center gap-1 rounded-[10px] pe-1';
const FOCUS_CLASS = 'outline-hidden focus-visible:outline';

/** One attached add-on in a list: a button showing its icon, name, version and a line, with a remove beside it. */
export const AddOnListItem: FC<AddOnListItemProps> = ({
  name,
  version,
  iconUrl,
  fileType,
  iconSize = 36,
  path,
  description,
  trailing,
  credentials,
  labels,
  colors,
  titleClassName = 'dial-small-semi-text',
  versionClassName = 'dial-tiny-text',
  descriptionClassName = 'dial-tiny-text',
  isDisabled = false,
  onOpen,
  onRemove,
}) => {
  const nameId = useId();
  const descriptionId = useId();
  const hasDescription = description != null && description !== '';
  const cssVars = buildCssVars({
    '--cat-add-on-row-hover-bg': colors?.rowHoverBackground,
    '--cat-add-on-focus-outline': colors?.focusOutline,
    '--cat-add-on-description': colors?.description,
  });

  /* Hidden as a whole: the button is named by the item, and a badge's meaning
     belongs in the description the host passes. */
  const icon = (
    <span aria-hidden="true" className="relative shrink-0">
      {fileType ? (
        <span
          className="flex items-center justify-center"
          style={{ width: iconSize, height: iconSize }}
        >
          <FileIcon decorative size={24} name={name} type={fileType} />
        </span>
      ) : (
        <DeploymentIcon
          size={iconSize}
          src={iconUrl}
          initialsName={name}
          styles={{ badgeClassName: 'rounded-[10px]' }}
        />
      )}
      {credentials && (
        <CredentialsBadge
          credentials={credentials}
          loggedOutLabel={labels?.credentialsBadge}
        />
      )}
    </span>
  );
  const line = hasDescription && (
    <span
      id={descriptionId}
      className={mergeClasses(
        'truncate',
        styles.description,
        descriptionClassName,
      )}
    >
      {description}
    </span>
  );
  const buttonA11y = {
    'aria-describedby': hasDescription ? descriptionId : undefined,
  };

  return (
    <div className={mergeClasses(ROW_CLASS, styles.row)} style={cssVars}>
      {path ? (
        <>
          {/* A trail is not phrasing content, so it cannot sit in the button:
              the button covers the row and the trail lies under it. */}
          <button
            type="button"
            aria-label={name}
            {...buttonA11y}
            disabled={isDisabled}
            className={mergeClasses(
              'absolute inset-0 rounded-[10px] bg-transparent',
              FOCUS_CLASS,
              styles.focusable,
            )}
            onClick={onOpen}
          />
          <span className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5 py-1">
            {icon}
            <span className="flex min-w-0 flex-1 flex-col">
              <Breadcrumbs
                items={path.map((label) => ({ label }))}
                ariaLabel={labels?.location ?? 'Location'}
              />
              {line}
            </span>
          </span>
        </>
      ) : (
        // A native button: the kit's buttons take only a label and icons.
        <button
          type="button"
          aria-labelledby={nameId}
          {...buttonA11y}
          disabled={isDisabled}
          className={mergeClasses(
            'flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] py-1 text-start',
            FOCUS_CLASS,
            styles.focusable,
          )}
          onClick={onOpen}
        >
          {icon}
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={nameId} className="min-w-0">
              <ItemHeader
                title={name}
                postfix={version || undefined}
                titleClassName={titleClassName}
                postfixClassName={versionClassName}
                colors={{ title: colors?.title, count: colors?.version }}
                className="min-w-0 items-baseline gap-1.5"
              />
            </span>
            {line}
          </span>
        </button>
      )}
      {trailing != null && (
        <span className="pointer-events-none flex shrink-0 items-center gap-1">
          {trailing}
        </span>
      )}
      {onRemove && (
        // Hidden with opacity, not `hidden`, so it stays in the tab order; above the stretched button.
        <GhostIconButton
          size={ElementSize.Small}
          icon={
            <IconTrash
              aria-hidden
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={labels?.remove ?? `Remove ${name}`}
          disabled={isDisabled}
          className="relative shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
        />
      )}
    </div>
  );
};
