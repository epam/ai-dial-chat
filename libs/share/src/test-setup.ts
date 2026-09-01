/* eslint-disable @typescript-eslint/no-empty-function */
/* `ToggleIconButton`'s tooltip (used by `CopyIconButton` in the link row) needs this. */
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});
