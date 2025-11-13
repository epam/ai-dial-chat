import { Icon, IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Button } from '@/src/components/Common/Button';
import { MenuItem } from '@/src/components/Common/DropdownMenu';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { LikeState, onLikeMessageHandler } from '@epam/ai-dial-shared';

interface LikeItemProps {
  targetStatus: LikeState;
  Icon: Icon;
  label: string;
  dataQa: string;
  wasClicked: boolean;
  onLike: onLikeMessageHandler;
}

const DesktopLikeView = ({
  targetStatus,
  wasClicked,
  onLike,
  Icon,
  label,
  dataQa,
}: LikeItemProps) => (
  <Tooltip placement="top" isTriggerClickable={!wasClicked} tooltip={label}>
    <Button
      onClick={() => {
        if (!wasClicked) {
          onLike(targetStatus);
        }
      }}
      className={!wasClicked ? 'text-secondary' : 'text-accent-primary'}
      disabled={wasClicked}
      data-qa={dataQa}
    >
      <Icon size={18} />
    </Button>
  </Tooltip>
);

const MobileLikeView = ({
  targetStatus,
  wasClicked,
  onLike,
  Icon,
  label,
  dataQa,
}: LikeItemProps) => (
  <MenuItem
    disabled={wasClicked}
    className={classNames(!wasClicked && 'hover:bg-accent-primary-alpha')}
    data-qa={dataQa}
    item={
      <div className="flex items-center gap-3">
        <Icon className="text-secondary" size={18} />
        <p className={classNames(wasClicked && 'text-secondary')}>{label}</p>
      </div>
    }
    onClick={() => {
      if (!wasClicked) {
        onLike(targetStatus);
      }
    }}
  />
);

interface LikeViewProps {
  likeStatus: LikeState;
  targetStatus: LikeState;
  onLike: onLikeMessageHandler;
  isMobile?: boolean;
}

const LikeView = ({
  likeStatus,
  targetStatus,
  isMobile,
  onLike,
}: LikeViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const wasClicked = likeStatus !== LikeState.NoState;
  const { Icon, label, dataQa } = useMemo(() => {
    if (targetStatus === LikeState.Liked) {
      return {
        Icon: IconThumbUp,
        label: t(wasClicked ? 'Liked' : 'Like'),
        dataQa: 'like',
      };
    }
    return {
      Icon: IconThumbDown,
      label: t(wasClicked ? 'Disliked' : 'Dislike'),
      dataQa: 'dislike',
    };
  }, [t, targetStatus, wasClicked]);

  const View = isMobile ? MobileLikeView : DesktopLikeView;

  return (
    <View
      targetStatus={targetStatus}
      Icon={Icon}
      wasClicked={wasClicked}
      dataQa={dataQa}
      label={label}
      onLike={onLike}
    />
  );
};

interface MessageLikesProps {
  likeStatus: LikeState | undefined;
  onLike: onLikeMessageHandler;
  isMobile?: boolean;
}

export const MessageLikes = ({
  likeStatus = LikeState.NoState,
  onLike,
  isMobile,
}: MessageLikesProps) => {
  return (
    <>
      {likeStatus !== LikeState.Disliked && (
        <LikeView
          likeStatus={likeStatus}
          targetStatus={LikeState.Liked}
          onLike={onLike}
          isMobile={isMobile}
        />
      )}
      {likeStatus !== LikeState.Liked && (
        <LikeView
          likeStatus={likeStatus}
          targetStatus={LikeState.Disliked}
          onLike={onLike}
          isMobile={isMobile}
        />
      )}
    </>
  );
};
