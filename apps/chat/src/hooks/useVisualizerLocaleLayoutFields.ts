import { useMemo } from 'react';

import { useRouter } from 'next/router';

import { isRtlLocale } from '@/src/utils/app/rtl';

import i18nextConfig from '@/next-i18next.config';
import { CustomVisualizerDataLayout } from '@epam/ai-dial-shared';

export const useVisualizerLocaleLayoutFields =
  (): Partial<CustomVisualizerDataLayout> => {
    const router = useRouter();

    return useMemo(() => {
      const currentLocale = router.locale ?? i18nextConfig.i18n.defaultLocale;
      const dir = isRtlLocale(currentLocale) ? 'rtl' : 'ltr';

      return { currentLocale, dir };
    }, [router.locale]);
  };
