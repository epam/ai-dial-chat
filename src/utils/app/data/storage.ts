/* eslint-disable no-restricted-globals */
import toast from 'react-hot-toast';

import { errorsMessages } from '@/src/constants/errors';

export const isLocalStorageEnabled = () => {
  const testData = 'test';
  try {
    localStorage.setItem(testData, testData);
    localStorage.removeItem(testData);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast.error(errorsMessages.localStorageQuotaExceeded);
      return true;
    } else {
      // eslint-disable-next-line no-console
      console.info(
        'Local storage is unavailable and session storage is used for data instead',
      );
      return false;
    }
  }
};
