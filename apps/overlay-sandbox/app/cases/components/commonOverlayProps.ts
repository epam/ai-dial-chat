export const commonOverlayProps = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST ?? '',
  requestTimeout: 20000,
  loaderStyles: {
    background: 'white',
    fontSize: '24px',
  },
};
