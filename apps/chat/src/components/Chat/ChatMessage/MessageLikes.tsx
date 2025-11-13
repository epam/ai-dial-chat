import { IconThumbDown, IconThumbUp } from '@tabler/icons-react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Button } from '@/src/components/Common/Button';
import { MenuItem } from '@/src/components/Common/DropdownMenu';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { LikeState, onLikeMessageHandler } from '@epam/ai-dial-shared';

interface MessageLikesProps {
  likeStatus: LikeState | undefined;
  onLike: onLikeMessageHandler;
}

export const MessageLikes = ({
  likeStatus = LikeState.NoState,
  onLike,
}: MessageLikesProps) => {
  const { t } = useTranslation(Translation.Chat);
  const wasClicked = likeStatus !== LikeState.NoState;
  return (
    <div className="flex flex-row gap-2">
      {likeStatus !== LikeState.Disliked && (
        <Tooltip
          placement="top"
          isTriggerClickable={!wasClicked}
          tooltip={!wasClicked ? t('Like') : t('Liked')}
        >
          <Button
            onClick={() => {
              if (!wasClicked) {
                onLike(LikeState.Liked);
              }
            }}
            className={!wasClicked ? 'text-secondary' : 'text-accent-primary'}
            disabled={wasClicked}
            data-qa="like"
          >
            <IconThumbUp size={18} />
          </Button>
        </Tooltip>
      )}
      {likeStatus !== LikeState.Liked && (
        <Tooltip
          placement="top"
          isTriggerClickable={!wasClicked}
          tooltip={t(!wasClicked ? 'Dislike' : 'Disliked')}
        >
          <Button
            onClick={() => {
              if (!wasClicked) {
                onLike(LikeState.Disliked);
              }
            }}
            className={!wasClicked ? 'text-secondary' : 'text-accent-primary'}
            disabled={wasClicked}
            data-qa="dislike"
          >
            <IconThumbDown size={18} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export const MessageMobileLikes = ({
  likeStatus = LikeState.NoState,
  onLike,
}: MessageLikesProps) => {
  const { t } = useTranslation(Translation.Chat);
  const wasClicked = likeStatus !== LikeState.NoState;
  return (
    <>
      {likeStatus !== LikeState.Disliked && (
        <MenuItem
          disabled={wasClicked}
          className={classNames(!wasClicked && 'hover:bg-accent-primary-alpha')}
          data-qa="like"
          item={
            <div className="flex items-center gap-3">
              <IconThumbUp className="text-secondary" size={18} />
              <p className={classNames(wasClicked && 'text-secondary')}>
                {wasClicked ? t('Liked') : t('Like')}
              </p>
            </div>
          }
          onClick={() => {
            if (!wasClicked) {
              onLike(LikeState.Liked);
            }
          }}
        />
      )}
      {likeStatus !== LikeState.Liked && (
        <MenuItem
          disabled={wasClicked}
          className={classNames(!wasClicked && 'hover:bg-accent-primary-alpha')}
          data-qa="dislike"
          item={
            <div className="flex items-center gap-3">
              <IconThumbDown className="text-secondary" size={18} />
              <p className={classNames(wasClicked && 'text-secondary')}>
                {wasClicked ? t('Disliked') : t('Dislike')}
              </p>
            </div>
          }
          onClick={() => {
            if (!wasClicked) {
              onLike(LikeState.Disliked);
            }
          }}
        />
      )}
    </>
  );
};
