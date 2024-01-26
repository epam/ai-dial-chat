import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

import '../src/styles/globals.css';

// use "data-qa" instead of "data-testid" to share it with e2e tests
configure({
  testIdAttribute: 'data-qa',
});
