import { makeSnykRequest } from '../../../src/lib/request/request';
import * as fs from 'fs';
import * as nock from 'nock';
import * as _ from 'lodash';
import * as path from 'path';
import axios from 'axios';

import {
  NotFoundError,
  ApiError,
  ApiAuthenticationError,
  GenericError,
} from '../../../src/lib/customErrors/apiError';

const fixturesFolderPath = path.resolve(__dirname, '../..') + '/fixtures/';
beforeEach(() => {
  return nock('https://api.snyk.io')
    .persist()
    .get(/\/xyz/)
    .reply(404, '404')
    .get(/\/customtoken/)
    .reply(200, function() {
      return this.req.headers.authorization;
    })
    .post(/\/xyz/)
    .reply(404, '404')
    .get(/\/apierror/)
    .reply(500, '500')
    .post(/\/apierror/)
    .reply(500, '500')
    .get(/\/genericerror/)
    .reply(512, '512')
    .post(/\/genericerror/)
    .reply(512, '512')
    .get(/\/gotimeout/)
    .delayConnection(32000)
    .reply(504, '504')
    .get(/\/apiautherror/)
    .reply(401, '401')
    .post(/\/apiautherror/)
    .reply(401, '401')
    .post(/^(?!.*xyz).*$/)
    .reply(200, (uri, requestBody) => {
      switch (uri) {
        case '/rest/':
          return requestBody;
          break;
        default:
      }
    })
    .patch(/^(?!.*xyz).*$/)
    .reply(200, (uri, requestBody) => {
      switch (uri) {
        case '/rest/':
          return requestBody;
          break;
        default:
      }
    })
    .get(/^(?!.*xyz).*$/)
    .reply(200, (uri) => {
      switch (uri) {
        case '/rest/':
          return fs.readFileSync(
            fixturesFolderPath + 'apiResponses/general-doc.json',
          );
          break;
        default:
      }
    });
});

const OLD_ENV = process.env;
beforeEach(() => {
  jest.resetModules(); // this is important - it clears the cache
  process.env = { ...OLD_ENV };
  delete process.env.SNYK_TOKEN;
});

afterEach(() => {
  process.env = OLD_ENV;
  jest.restoreAllMocks();
});

describe('Test Snyk Utils make request properly', () => {
  it('Test GET command on /', async () => {
    const axiosSpy = jest.spyOn(axios, 'create');
    const response = await makeSnykRequest(
      { verb: 'GET', url: '/', useRESTApi: true },
      'token123',
    );
    const fixturesJSON = JSON.parse(
      fs
        .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
        .toString(),
    );
    expect(response.data).toEqual(fixturesJSON);
    expect(axiosSpy).toHaveBeenCalledWith({
      baseURL: 'https://api.snyk.io/rest/',
      headers: {
        Authorization: 'token token123',
        'Content-Type': 'application/json',
        'User-Agent': 'tech-services/snyk-request-manager/1.0',
      },
      responseType: 'json',
      timeout: 30000,
      transitional: { clarifyTimeoutError: true },
    });
  });
  it('Test POST command on /', async () => {
    const axiosSpy = jest.spyOn(axios, 'create');

    const bodyToSend = {
      testbody: {},
    };
    const response = await makeSnykRequest(
      {
        verb: 'POST',
        url: '/',
        body: JSON.stringify(bodyToSend),
        useRESTApi: true,
      },
      'token123',
    );
    expect(response.data).toEqual(bodyToSend);
    expect(axiosSpy).toHaveBeenCalledWith({
      baseURL: 'https://api.snyk.io/rest/',
      headers: {
        Authorization: 'token token123',
        'Content-Type': 'application/vnd.api+json',
        'User-Agent': 'tech-services/snyk-request-manager/1.0',
      },
      responseType: 'json',
      timeout: 30000,
      transitional: { clarifyTimeoutError: true },
    });
  });
  it('Test PATCH command on /', async () => {
    const axiosSpy = jest.spyOn(axios, 'create');

    const bodyToSend = {
      testbody: {},
    };
    const response = await makeSnykRequest(
      {
        verb: 'PATCH',
        url: '/',
        body: JSON.stringify(bodyToSend),
        useRESTApi: true,
      },
      'token123',
    );
    expect(response.data).toEqual(bodyToSend);
    expect(axiosSpy).toHaveBeenCalledWith({
      baseURL: 'https://api.snyk.io/rest/',
      headers: {
        Authorization: 'token token123',
        'Content-Type': 'application/vnd.api+json',
        'User-Agent': 'tech-services/snyk-request-manager/1.0',
      },
      responseType: 'json',
      timeout: 30000,
      transitional: { clarifyTimeoutError: true },
    });
  });
});

describe('Test Snyk Utils error handling/classification', () => {
  it('Test NotFoundError on GET command', async () => {
    try {
      await makeSnykRequest(
        { verb: 'GET', url: '/xyz', body: '', useRESTApi: true },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(404);
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('Test NotFoundError on POST command', async () => {
    try {
      const bodyToSend = {
        testbody: {},
      };
      await makeSnykRequest(
        {
          verb: 'POST',
          url: '/xyz',
          body: JSON.stringify(bodyToSend),
          useRESTApi: true,
        },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(404);
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('Test ApiError on GET command', async () => {
    try {
      await makeSnykRequest(
        { verb: 'GET', url: '/apierror', useRESTApi: true },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(500);
      expect(err).toBeInstanceOf(ApiError);
    }
  });
  it('Test ApiError on POST command', async () => {
    try {
      const bodyToSend = {
        testbody: {},
      };
      await makeSnykRequest(
        {
          verb: 'POST',
          url: '/apierror',
          body: JSON.stringify(bodyToSend),
          useRESTApi: true,
        },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(500);
      expect(err).toBeInstanceOf(ApiError);
    }
  });

  it('Test ApiAuthenticationError on GET command', async () => {
    try {
      await makeSnykRequest(
        { verb: 'GET', url: '/apiautherror', useRESTApi: true },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(401);
      expect(err).toBeInstanceOf(ApiAuthenticationError);
    }
  });
  it('Test ApiAuthenticationError on POST command', async () => {
    try {
      const bodyToSend = {
        testbody: {},
      };
      await makeSnykRequest(
        {
          verb: 'POST',
          url: '/apiautherror',
          body: JSON.stringify(bodyToSend),
          useRESTApi: true,
        },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(401);
      expect(err).toBeInstanceOf(ApiAuthenticationError);
    }
  });

  it('Test GenericError on GET command', async () => {
    try {
      await makeSnykRequest(
        { verb: 'GET', url: '/genericerror', useRESTApi: true },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(512);
      expect(err).toBeInstanceOf(GenericError);
    }
  });
  it('Test GenericError on POST command', async () => {
    try {
      const bodyToSend = {
        testbody: {},
      };
      await makeSnykRequest(
        {
          verb: 'POST',
          url: '/genericerror',
          body: JSON.stringify(bodyToSend),
          useRESTApi: true,
        },
        'token123',
      );
    } catch (err) {
      expect(err.data).toEqual(512);
      expect(err).toBeInstanceOf(GenericError);
    }
  });

  it('Test Timeout error on POST command', async () => {
    try {
      const bodyToSend = {
        testbody: {},
      };
      await makeSnykRequest(
        {
          verb: 'GET',
          url: '/gotimeout',
          body: JSON.stringify(bodyToSend),
          useRESTApi: true,
        },
        'token123',
      );
    } catch (err) {
      expect(err).toBeInstanceOf(GenericError);
      expect(err.message.config.headers.Authorization).toBe('****');
    }
  });
});
