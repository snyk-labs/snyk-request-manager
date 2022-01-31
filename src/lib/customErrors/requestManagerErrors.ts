import * as debugModule from 'debug';

import {
  ApiError,
  ApiAuthenticationError,
  NotFoundError,
  GenericError,
} from './apiError';
const debug = debugModule('snyk');

class RequestsManagerApiError extends ApiError {
  channel: string;
  requestId: string;
  constructor(message: string, channel: string, requestId: string) {
    super(message);
    this.name = 'ApiError';
    this.channel = channel;
    this.requestId = requestId;
    this.message = message || '';
  }
}

class RequestsManagerApiAuthenticationError extends ApiAuthenticationError {
  channel: string;
  requestId: string;
  constructor(message: string, channel: string, requestId: string) {
    super(message);
    this.name = 'ApiAuthenticationError';
    this.channel = channel;
    this.requestId = requestId;
    this.message = message || '';
  }
}

class RequestsManagerNotFoundError extends NotFoundError {
  channel: string;
  requestId: string;
  constructor(message: string, channel: string, requestId: string) {
    super(message);
    this.name = 'NotFoundError';
    this.channel = channel;
    this.requestId = requestId;
    this.message = message || '';
  }
}

class RequestsManagerGenericError extends GenericError {
  channel: string;
  requestId: string;
  constructor(message: string, channel: string, requestId: string) {
    super(message);
    this.name = 'Unknown';
    this.channel = channel;
    this.requestId = requestId;
    this.message = message || '';
  }
}

const requestsManagerErrorOverload = (
  err: Error,
  channel: string,
  requestId: string,
): Error => {
  debug('ERROR:', err);
  switch (err?.name) {
    case 'ApiError':
      return new RequestsManagerApiError(err.message, channel, requestId);
    case 'ApiAuthenticationError':
      return new RequestsManagerApiAuthenticationError(
        err.message,
        channel,
        requestId,
      );
    case 'NotFoundError':
      return new RequestsManagerNotFoundError(err.message, channel, requestId);
    case 'Unknown':
      return new RequestsManagerGenericError(err.message, channel, requestId);
    default:
  }
  return new RequestsManagerGenericError('Unclassified', channel, requestId);
};

export {
  RequestsManagerApiError,
  RequestsManagerApiAuthenticationError,
  RequestsManagerNotFoundError,
  RequestsManagerGenericError,
  requestsManagerErrorOverload,
};
