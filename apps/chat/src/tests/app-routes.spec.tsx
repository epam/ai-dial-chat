import { render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { buildAppRoutes } from '../app-routes';

// react-i18next is globally mocked in test-setup.ts; t(key) returns the key string.

const ThrowingRoot: FC = () => {
  throw new Error("Cannot read properties of undefined (reading 'split')");
};

const renderRoutes = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(buildAppRoutes(<ThrowingRoot />))}
    />,
  );

describe('buildAppRoutes', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the root fallback instead of the router error page when the root throws', () => {
    renderRoutes();

    expect(
      screen.getByRole('region', { name: 'errorBoundary.heading' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'errorBoundary.reloadLabel' }),
    ).toBeTruthy();
    expect(screen.queryByText('Unexpected Application Error!')).toBeNull();
    expect(screen.queryByText(/reading 'split'/)).toBeNull();
  });

  it('logs the error through the root boundary', () => {
    renderRoutes();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary] Caught root error:',
      expect.any(Error),
      expect.anything(),
    );
  });
});
