import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { memo, useEffect, type FC } from 'react';

interface Props {
  title: string;
  description: string;
  onDismiss: () => void;
}

const DISMISS_DELAY_MS = 3000;

const RatingToast: FC<Props> = ({ title, description, onDismiss }) => {
  useEffect(() => {
    const id = setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => clearTimeout(id);
  }, [title, onDismiss]);

  return (
    <div className="fixed start-1/2 top-6 z-50 -translate-x-1/2">
      <DialNotification
        variant={NotificationVariant.Success}
        title={title}
        message={description}
        closable={true}
      />
    </div>
  );
};

export default memo(RatingToast);
