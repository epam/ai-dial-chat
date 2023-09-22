class TimeoutError extends Error {
  constructor() {
    super('Timeout occurs');
  }
}

export const timeoutAsync = (t: number) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new TimeoutError());
    }, t);
  });
