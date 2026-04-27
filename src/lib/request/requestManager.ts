// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS package without bundled types
import Configstore = require('@snyk/configstore');
import { LeakyBucketQueue } from 'leaky-bucket-queue';
import { SnykRequest, makeSnykRequest, DEFAULT_API } from './request';
import { randomBytes, randomUUID } from 'crypto';
import { URL } from 'url';
import * as requestsManagerError from '../customErrors/requestManagerErrors';

interface QueuedRequest {
  id: string;
  channel: string;
  snykRequest: SnykRequest;
}
interface QueueCallbackListenerBundle {
  callback(requestId: string, data: unknown): void;
  channel?: string;
}
enum eventType {
  data = 'data',
  error = 'error',
}
interface ResponseEvent {
  eventType: eventType;
  channel: string;
  requestId: string;
  data: unknown;
}

interface RequestsManagerParams {
  snykToken?: string;
  burstSize?: number;
  period?: number;
  maxRetryCount?: number;
  userAgentPrefix?: string;
}

function getRESTAPI(endpoint: string): string {
  // e.g 'https://api.snyk.io/rest/'
  const apiData = new URL(endpoint);
  if (!apiData.host.startsWith('api.') && process.env.NODE_ENV != 'test') {
    console.warn(
      `${apiData.host} seems invalid and should look like https://api.snyk.io or https://api.<REGION>.snyk.io.`,
    );
  }
  return new URL(`${apiData.protocol}//${apiData.host}/rest`).toString();
}

function getOauthToken(): string {
  const oauthToken: string = process.env.SNYK_OAUTH_TOKEN || '';
  return oauthToken;
}

const getConfig = (): { endpoint: string; token: string } => {
  const rawEndpoint =
    process.env.SNYK_API ||
    new Configstore('snyk').get('endpoint') ||
    DEFAULT_API;
  const snykApiEndpoint =
    typeof rawEndpoint === 'string' ? rawEndpoint : String(rawEndpoint ?? '');
  const rawToken = process.env.SNYK_TOKEN || new Configstore('snyk').get('api');
  const snykToken =
    typeof rawToken === 'string' ? rawToken : String(rawToken ?? '');
  return { endpoint: snykApiEndpoint, token: snykToken };
};

function createRequestId(): string {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }

  // Keep compatibility with older runtimes that do not expose crypto.randomUUID.
  return randomBytes(16).toString('hex');
}

class RequestsManager {
  _requestsQueue: LeakyBucketQueue<QueuedRequest>;
  _events: Record<string, QueueCallbackListenerBundle[]>;
  _userConfig: {
    endpoint: string;
    token: string;
  }; // loaded user config from configstore
  _apiUrl: string;
  _apiUrlREST: string;
  _retryCounter: Map<string, number>;
  _MAX_RETRY_COUNT: number;
  _snykToken: string;
  _oauthBearerToken?: string; // Optional OAuth token
  _userAgentPrefix?: string;

  //snykToken = '', burstSize = 10, period = 500, maxRetryCount = 5
  constructor(params: RequestsManagerParams = {}) {
    this._userConfig = getConfig();
    this._requestsQueue = new LeakyBucketQueue<QueuedRequest>({
      burstSize: params?.burstSize || 10,
      period: params?.period || 500,
    });
    this._setupQueueExecutors(this._requestsQueue);
    this._events = {};
    this._retryCounter = new Map();
    this._MAX_RETRY_COUNT = params?.maxRetryCount || 5;
    this._oauthBearerToken = getOauthToken();
    this._snykToken = params?.snykToken ?? this._userConfig.token;
    this._apiUrl = this._userConfig.endpoint;
    this._apiUrlREST = getRESTAPI(this._userConfig.endpoint);
    this._userAgentPrefix = params?.userAgentPrefix;
  }

  _setupQueueExecutors = (queue: LeakyBucketQueue<QueuedRequest>): void => {
    queue.consume().subscribe({
      next: this._makeRequest,
      error: this._queueErrorHandler,
      complete: () => {
        console.log('Stopped queue');
      },
    });
  };

  _makeRequest = async (request: QueuedRequest): Promise<void> => {
    const requestId = request.id;
    try {
      // Pass oauthBearerToken if available
      if (
        this._oauthBearerToken != null &&
        this._oauthBearerToken.trim() != ''
      ) {
        const response = await makeSnykRequest(
          request.snykRequest,
          '',
          this._oauthBearerToken,
          this._apiUrl,
          this._apiUrlREST,
          this._userAgentPrefix,
        );
        this._emit({
          eventType: eventType.data,
          channel: request.channel,
          requestId,
          data: response,
        });
      } else {
        const response = await makeSnykRequest(
          request.snykRequest,
          this._snykToken,
          '',
          this._apiUrl,
          this._apiUrlREST,
          this._userAgentPrefix,
        );
        this._emit({
          eventType: eventType.data,
          channel: request.channel,
          requestId,
          data: response,
        });
      }
    } catch (err) {
      const overloadedError = requestsManagerError.requestsManagerErrorOverload(
        err as Error,
        request.channel,
        requestId,
      );
      const alreadyRetriedCount = this._retryCounter.get(requestId) || 0;
      if (
        (err instanceof Error && err.name === 'NotFoundError') ||
        alreadyRetriedCount >= this._MAX_RETRY_COUNT
      ) {
        this._emit({
          eventType: eventType.error,
          channel: request.channel,
          requestId: requestId,
          data: overloadedError,
        });
      } else {
        this._retryCounter.set(requestId, alreadyRetriedCount + 1);
        // Throw it back into the queue
        this.requestStream(request.snykRequest, request.channel, request.id);
      }
    }
  };

  _queueErrorHandler = (err: Error): void => {
    //debug(err)
    // TODO: Add retry logic
    // Track request ID count and throw it back into the queue
    // Throw error when count > MAX_RETRIES_LIMIT
    throw new Error(err.stack);
  };

  _emit = (response: ResponseEvent): void => {
    if (!this._events[response.eventType]) {
      throw new Error(
        `Can't emit an event. Event "${eventType}" doesn't exits.`,
      );
    }

    const fireCallbacks = (
      listenerBundle: QueueCallbackListenerBundle,
    ): void => {
      if (response.channel == listenerBundle.channel) {
        listenerBundle.callback(response.requestId, response.data);
      }
    };

    this._events[response.eventType].forEach(fireCallbacks);
  };

  _removeAllListenersForChannel = (channel: string): void => {
    Object.keys(eventType).forEach((typeOfEvent) => {
      if (!this._events[typeOfEvent]) {
        throw new Error(
          `Can't remove a listener. Event "${typeOfEvent}" doesn't exits.`,
        );
      }
      const filterListeners = (
        callbackListener: QueueCallbackListenerBundle,
      ): boolean => callbackListener.channel !== channel;

      this._events[typeOfEvent] =
        this._events[typeOfEvent].filter(filterListeners);
    });
  };

  _doesChannelHaveListeners = (channel: string): boolean => {
    const dataEventListeners = this._events[
      'data'
    ] as Array<QueueCallbackListenerBundle>;
    return dataEventListeners.some((listener) => listener.channel == channel);
  };

  request = (request: SnykRequest): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const syncRequestChannel = createRequestId();

      const callbackBundle = {
        callback: (originalRequestId: string, data: unknown) => {
          // TODO: double check this is ok

          if (requestId == originalRequestId) {
            this._removeAllListenersForChannel(syncRequestChannel);
            resolve(data);
          }
        },
        channel: syncRequestChannel,
      };
      const errorCallbackBundle = {
        callback: (originalRequestId: string, data: unknown) => {
          // TODO: double check this is ok

          if (requestId == originalRequestId) {
            this._removeAllListenersForChannel(syncRequestChannel);
            reject(data);
          }
        },
        channel: syncRequestChannel,
      };

      this.on('data', callbackBundle);
      this.on('error', errorCallbackBundle);
      const requestId = this.requestStream(request, syncRequestChannel);
    });
  };

  requestBulk = (snykRequestsArray: Array<SnykRequest>): Promise<unknown[]> => {
    return new Promise((resolve, reject) => {
      // Fire off all requests in Array and return only when responses are all returned
      // Must return array of responses in the same order.
      const requestsMap: Map<string, unknown> = new Map();
      const bulkRequestChannel = createRequestId();
      let isErrorInAtLeastOneRequest = false;
      let requestRemainingCount = snykRequestsArray.length;
      const callbackBundle = {
        callback: (originalRequestId: string, data: unknown) => {
          requestsMap.set(originalRequestId, data);
          requestRemainingCount--;
          if (requestRemainingCount <= 0) {
            const responsesArray: unknown[] = [];
            requestsMap.forEach((value) => {
              responsesArray.push(value);
            });
            if (isErrorInAtLeastOneRequest) {
              reject(responsesArray);
            } else {
              resolve(responsesArray);
            }
          }
        },
        channel: bulkRequestChannel,
      };
      const errorCallbackBundle = {
        callback: (originalRequestId: string, data: unknown) => {
          isErrorInAtLeastOneRequest = true;
          callbackBundle.callback(originalRequestId, data);
        },
        channel: bulkRequestChannel,
      };

      this.on('data', callbackBundle);
      this.on('error', errorCallbackBundle);

      snykRequestsArray.forEach((snykRequest) => {
        requestsMap.set(
          this.requestStream(snykRequest, bulkRequestChannel),
          {},
        );
      });
    });
  };

  requestStream = (
    request: SnykRequest,
    channel = 'stream',
    id = '',
  ): string => {
    const requestId = id ? id : createRequestId();
    const requestForQueue: QueuedRequest = {
      id: requestId,
      channel: channel,
      snykRequest: request,
    };
    this._requestsQueue.enqueue(requestForQueue);
    if (!this._doesChannelHaveListeners(channel)) {
      throw new Error(`Not listener(s) setup for channel ${channel}`);
    }
    return requestId;
  };

  on = (
    eventType: string,
    listenerBundle: QueueCallbackListenerBundle,
  ): void => {
    if (!this._events[eventType]) {
      this._events[eventType] = [];
    }
    if (!listenerBundle.channel) {
      listenerBundle.channel = 'stream';
    }
    this._events[eventType].push(listenerBundle);
  };
}

export { RequestsManager as requestsManager, getConfig };
