import axios, { AxiosResponse } from 'axios';
import * as Error from '../customErrors/apiError';

// Fixes issue https://github.com/axios/axios/issues/3384
// where HTTPS over HTTP Proxy Fails with 500 handshakefailed on mcafee proxy
import 'global-agent/bootstrap';

const DEFAULT_API = 'https://snyk.io/api/v1';
const DEFAULT_REST_API = 'https://api.snyk.io/rest/';
interface SnykRequest {
  verb: string;
  url: string;
  body?: string;
  headers?: Record<string, any>;
  requestId?: string;
  useRESTApi?: boolean;
}

const getTopParentModuleName = (parent: NodeModule | null): string => {
  if (parent == null) {
    return '';
  }
  if (parent?.parent) {
    return getTopParentModuleName(parent.parent);
  } else {
    return (parent?.paths[0].split('/')[parent.paths[0].split('/').length - 2] +
      '/') as string;
  }
};

const makeSnykRequest = async (
  request: SnykRequest,
  snykToken = '',
  apiUrl = DEFAULT_API,
  apiUrlREST = DEFAULT_REST_API,
  userAgentPrefix = '',
): Promise<AxiosResponse<any>> => {
  const topParentModuleName = getTopParentModuleName(module.parent as any);
  const userAgentPrefixChecked =
    userAgentPrefix != '' && !userAgentPrefix.endsWith('/')
      ? userAgentPrefix + '/'
      : userAgentPrefix;
  const requestHeaders: Record<string, any> = {
    'Content-Type':
      request.useRESTApi && request.body
        ? 'application/vnd.api+json'
        : 'application/json',
    Authorization: 'token ' + snykToken,
    'User-Agent': `${topParentModuleName}${userAgentPrefixChecked}tech-services/snyk-request-manager/1.0`,
  };

  const apiClient = axios.create({
    baseURL: request.useRESTApi ? apiUrlREST : apiUrl,
    responseType: 'json',
    headers: { ...requestHeaders, ...request.headers },
    transitional: {
      clarifyTimeoutError: true,
    },
    timeout: 30_000, // 5 mins same as Snyk APIs
  });
  // sanitize error to avoid leaking sensitive data
  apiClient.interceptors.response.use(undefined, async (error) => {
    error.config.headers.Authorization = '****';
    return Promise.reject(error);
  });

  try {
    let res;
    switch (request.verb.toUpperCase()) {
      case 'GET':
        res = await apiClient.get(request.url);
        break;
      case 'POST':
        res = await apiClient.post(request.url, request.body);
        break;
      case 'PUT':
        res = await apiClient.put(request.url, request.body);
        break;
      case 'PATCH':
        res = await apiClient.patch(request.url, request.body);
        break;
      case 'DELETE':
        res = await apiClient.delete(request.url);
        break;
      default:
        throw new Error.GenericError('Unexpected http command');
    }
    return res;
  } catch (err) {
    switch (err.response?.status) {
      case 401:
        throw new Error.ApiAuthenticationError(err);
      case 404:
        throw new Error.NotFoundError(err);
      case 500:
        throw new Error.ApiError(err);
      default:
        throw new Error.GenericError(err);
    }
  }
};

export { makeSnykRequest, SnykRequest, DEFAULT_API };
