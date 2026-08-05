import { memo, useEffect, type FC } from 'react';

/**
 * Minimal page rendered after a successful overlay popup-login redirect.
 * Closes the auth tab/window immediately.
 */
const OverlayClose: FC = () => {
  useEffect(() => {
    window.close();
  }, []);

  return null;
};

export default memo(OverlayClose);
