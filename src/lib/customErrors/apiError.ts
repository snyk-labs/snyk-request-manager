import { isAxiosError } from 'axios';

function responseData(message: unknown): unknown {
  return isAxiosError(message) ? (message.response?.data ?? '') : '';
}

class ApiError extends Error {
  data: unknown;

  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message ?? ''));
    this.name = 'ApiError';
    // Legacy: callers/tests expect the raw Axios error on `.message` (non-string).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional mismatch with Error['message']
    (this as any).message = message ?? '';
    this.data = responseData(message);
  }
}

class ApiAuthenticationError extends Error {
  data: unknown;

  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message ?? ''));
    this.name = 'ApiAuthenticationError';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional mismatch with Error['message']
    (this as any).message = message ?? '';
    this.data = responseData(message);
  }
}

class NotFoundError extends Error {
  data: unknown;

  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message ?? ''));
    this.name = 'NotFoundError';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional mismatch with Error['message']
    (this as any).message = message ?? '';
    this.data = responseData(message);
  }
}

class GenericError extends Error {
  data: unknown;

  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message ?? ''));
    this.name = 'Unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional mismatch with Error['message']
    (this as any).message = message ?? '';
    this.data = responseData(message);
  }
}

export { ApiError, ApiAuthenticationError, NotFoundError, GenericError };
