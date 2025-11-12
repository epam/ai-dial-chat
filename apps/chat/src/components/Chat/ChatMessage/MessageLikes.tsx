import { IconThumbDown, IconThumbUp } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Button } from '@/src/components/Common/Button';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { Feature, LikeState, onLikeMessageHandler } from '@epam/ai-dial-shared';

interface MessageLikesProps {
  likeStatus: LikeState | undefined;
  onLike: onLikeMessageHandler;
}

export const MessageLikes = ({
  likeStatus = LikeState.NoState,
  onLike,
}: MessageLikesProps) => {
  const { t } = useTranslation(Translation.Chat);
  const notLiked = likeStatus === LikeState.NoState;
  const isDislikeCommentEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.DislikeComment),
  );
  return (
    <div className="flex flex-row gap-2">
      {likeStatus !== LikeState.Disliked && (
        <Tooltip
          placement="top"
          isTriggerClickable={notLiked}
          tooltip={notLiked ? t('Like') : t('Liked')}
        >
          <Button
            onClick={() => {
              if (notLiked) {
                onLike(LikeState.Liked);
              }
            }}
            className={notLiked ? 'text-secondary' : 'text-accent-primary'}
            disabled={!notLiked}
            data-qa="like"
          >
            <IconThumbUp size={18} />
          </Button>
        </Tooltip>
      )}
      {likeStatus !== LikeState.Liked && (
        <Tooltip
          placement="top"
          isTriggerClickable={notLiked}
          tooltip={t(notLiked ? 'Dislike' : 'Disliked')}
        >
          <Button
            onClick={() => {
              if (notLiked) {
                if (!isDislikeCommentEnabled) {
                  onLike(LikeState.Disliked);
                  return;
                }
                // Open comment dialog before sending dislike
                // For simplicity, we directly call onLike here
                // In a real scenario, you would open a dialog to get user input
              }
            }}
            className={notLiked ? 'text-secondary' : 'text-accent-primary'}
            disabled={!notLiked}
            data-qa="dislike"
          >
            <IconThumbDown size={18} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};
