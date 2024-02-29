class TimeoutError extends Error {
  constructor() {
    super('Timeout occurs');
  }
}

export const timeoutAsync = (t: number) =>
  new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError());
    }, t);
  });
