import dynamic from 'next/dynamic';

export const commonOverlayProps = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
  requestTimeout: 20000,
  loaderStyles: {
    background: 'white',
    fontSize: '24px',
  },
};

const DynamicChatOverlayWrapper = dynamic(() =>
  import('../components/chatOverlayWrapper').then(
    (mod) => mod.ChatOverlayWrapper,
  ),
);

export default DynamicChatOverlayWrapper;
