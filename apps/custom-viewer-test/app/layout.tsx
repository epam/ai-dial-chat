import './global.css';

import React from 'react';

export const metadata = {
  title: 'Custom Viewer Test Page',
  description: 'This is a test page for the custom viewer.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
