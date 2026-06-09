import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { memo, useEffect, type FC } from 'react';

interface Props {
  message: string;
  onDismiss: () => void;
}

const DISMISS_DELAY_MS = 3000;

const RatingToast: FC<Props> = ({ message, onDismiss }) => {
  useEffect(() => {
    const id = setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  return (
    <div className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2">
      <DialNotification
        variant={NotificationVariant.Success}
        message={message}
      />
    </div>
  );
};

export default memo(RatingToast);
