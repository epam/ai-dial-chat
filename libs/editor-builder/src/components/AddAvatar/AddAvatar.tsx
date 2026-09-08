import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  Label,
  LinkButton,
} from '@epam/ai-dial-ui-kit';
import { IconPhoto, IconPlus } from '@tabler/icons-react';
import type { FC } from 'react';
import type { AddAvatarProps } from '../../models/add-avatar-props';
import styles from './AddAvatar.module.scss';

/** Avatar preview box with an "Add avatar" button and a format/size caption, for entity-icon editing flows. */
export const AddAvatar: FC<AddAvatarProps> = ({
  label,
  avatarUrl,
  avatarAlt = '',
  addAvatarLabel = 'Add avatar',
  captionText = 'PNG, JPG or SVG (max 1 MB)',
  onAddAvatarClick,
  styles: stylesProp,
  className,
}) => {
  const cssVars = buildCssVars({
    '--aa-box-bg': stylesProp?.colors?.boxBackgroundColor,
    '--aa-box-border': stylesProp?.colors?.boxBorderColor,
    '--aa-icon': stylesProp?.colors?.placeholderIconColor,
    '--aa-caption': stylesProp?.colors?.captionColor,
  });

  return (
    <div
      className={mergeClasses('flex flex-col gap-2', className)}
      style={cssVars}
    >
      <Label label={label} />
      <div className="flex items-start gap-3">
        <div
          className={mergeClasses(
            'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
            styles.box,
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={avatarAlt}
              className="h-16 w-16 object-cover"
            />
          ) : (
            <IconPhoto
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
              className={styles.icon}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <LinkButton
            size={ElementSize.Small}
            iconBefore={
              <IconPlus
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            className="w-fit"
            label={addAvatarLabel}
            onClick={onAddAvatarClick}
          />
          <span className={mergeClasses('dial-tiny-text', styles.caption)}>
            {captionText}
          </span>
        </div>
      </div>
    </div>
  );
};
