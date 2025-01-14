import { ComponentType, useEffect } from 'react';

const SERVER_SIDE_JSS_STYLES_ID = 'server-side-jss-styles';

export const appWithJss = <P extends object>(App: ComponentType<P>) => {
  return (props: P) => {
    useEffect(() => {
      const animationFrameId = requestAnimationFrame(() => {
        const serverStyles = globalThis.document.getElementById(
          SERVER_SIDE_JSS_STYLES_ID,
        );
        if (serverStyles) {
          serverStyles.parentNode?.removeChild(serverStyles);
        }
      });

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }, []);

    return <App {...props} />;
  };
};
