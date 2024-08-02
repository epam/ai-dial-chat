import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import hotToast, { Toast, ToastBar, Toaster } from 'react-hot-toast';

import { ToastType } from '@/src/types/toasts';

const getToastConfigByType = (toastType: ToastType) => {
  switch (toastType) {
    case ToastType.Error:
      return {
        type: 'error',
        Icon: IconAlertCircle,
        iconClass: 'text-error',
      };
    case ToastType.Success:
      return {
        type: 'success',
        Icon: IconCircleCheck,
        iconClass: 'text-success',
      };
    case ToastType.Warning:
      return {
        type: 'warning',
        Icon: IconAlertTriangle,
        iconClass: 'text-warning',
      };
    case ToastType.Info:
    default:
      return {
        type: 'info',
        Icon: IconInfoCircle,
        iconClass: 'text-info',
      };
  }
};

export const Toasts = () => (
  <Toaster toastOptions={{ duration: 9000 }}>
    {(toast: Toast) => {
      const { Icon, iconClass, type } = getToastConfigByType(
        toast.id as ToastType,
      );
      return (
        <ToastBar
          style={{
            backgroundColor: `var(--bg-${type})`,
            borderRadius: '3px',
            borderColor: `var(--stroke-${type})`,
            borderWidth: '1px',
            maxWidth: '730px',
            padding: '12px',
          }}
          toast={toast}
        >
          {({ message }) => (
            <>
              <span>
                {!toast.icon ? (
                  <Icon size={24} className={iconClass} stroke={1.5} />
                ) : (
                  toast.icon
                )}
              </span>
              <div className="mx-0.5 whitespace-pre-wrap text-sm leading-[21px] text-primary *:!whitespace-pre-wrap">
                {message}
              </div>
              <button onClick={() => hotToast.dismiss(toast.id)}>
                <IconX stroke={1} size={24} className="text-secondary" />
              </button>
            </>
          )}
        </ToastBar>
      );
    }}
  </Toaster>
);
