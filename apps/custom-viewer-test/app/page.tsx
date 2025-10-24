'use client';

import React, { useEffect } from 'react';

export default function Index() {
  useEffect(() => {
    window.parent.postMessage(
      { type: process.env.NEXT_PUBLIC_APP_NAME + '/READY' },
      process.env.NEXT_PUBLIC_VIEWER_HOST,
    );
    window.parent.postMessage(
      { type: process.env.NEXT_PUBLIC_APP_NAME + '/READY_TO_INTERACT' },
      process.env.NEXT_PUBLIC_VIEWER_HOST,
    );
  }, []);
  return (
    <>
      <h1>Custom Viewer Test Page</h1>
      <p>This is a test page for the custom viewer.</p>
    </>
  );
}
