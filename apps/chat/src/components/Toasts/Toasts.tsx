import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import hotToast, { Toast, ToastBar, Toaster } from 'react-hot-toast';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { CloseButton } from '@/src/components/Common/CloseButtons';

const getToastConfigByType = (toastType: ToastType) => {
  switch (toastType) {
    case ToastType.Error:
      return {
        type: ToastType.Error,
        Icon: IconAlertCircle,
        iconClass: 'text-error',
      };
    case ToastType.Success:
      return {
        type: ToastType.Success,
        Icon: IconCircleCheck,
        iconClass: 'text-success',
      };
    case ToastType.Warning:
      return {
        type: ToastType.Warning,
        Icon: IconAlertTriangle,
        iconClass: 'text-warning',
      };
    case ToastType.Info:
    default:
      return {
        type: ToastType.Info,
        Icon: IconInfoCircle,
        iconClass: 'text-info',
      };
  }
};

export const Toasts = () => {
  const { t } = useTranslation(Translation.Common);
  const traceIdLabel = t(CommonI18nKeys.TraceId);

  return (
    <Toaster toastOptions={{ duration: 9000 }} containerClassName="mt-1">
      {(toast: Toast) => {
        const { Icon, iconClass, type } = getToastConfigByType(
          toast.id as ToastType,
        );
        const traceId =
          'traceId' in toast && toast.traceId
            ? (toast.traceId as string)
            : undefined;

        return (
          <ToastBar
            style={{
              backgroundColor: `var(--bg-${type})`,
              borderRadius: '3px',
              borderColor: `var(--stroke-${type})`,
              borderWidth: '1px',
              maxWidth: isSmallScreen() ? '100%' : '730px',
              padding: '12px',
              zIndex: 9999,
            }}
            toast={toast}
          >
            {({ message }) => (
              <>
                <span>
                  {!toast.icon ? (
                    <Icon
                      size={DEFAULT_ICON_SIZES.STANDARD}
                      className={iconClass}
                      stroke={1.5}
                    />
                  ) : (
                    toast.icon
                  )}
                </span>
                <div className="flex flex-col px-0.5">
                  <div
                    style={{ wordBreak: 'break-word' }}
                    className="whitespace-pre-wrap text-sm leading-[21px] text-primary *:!whitespace-pre-wrap [&>div]:justify-start"
                  >
                    {message}
                  </div>
                  {traceId && (
                    <div className="mx-[10px] text-sm text-secondary" dir="ltr">
                      {traceIdLabel}: {traceId}
                    </div>
                  )}
                </div>
                <CloseButton
                  className="mt-0.5 self-start"
                  onClick={() => hotToast.dismiss(toast.id)}
                />
              </>
            )}
          </ToastBar>
        );
      }}
    </Toaster>
  );
};
