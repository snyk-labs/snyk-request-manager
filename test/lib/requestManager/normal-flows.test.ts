import { requestsManager } from '../../../src/lib/request/requestManager';
import * as fs from 'fs';
import * as nock from 'nock';
import * as _ from 'lodash';
import * as path from 'path';
import { RequestsManagerNotFoundError } from '../../../src/lib/customErrors/requestManagerErrors';

const fixturesFolderPath = path.resolve(__dirname, '../..') + '/fixtures/';
beforeAll(() => {
  return nock('https://snyk.io')
    .persist()
    .get(/\/customtoken/)
    .reply(200, function() {
      return this.req.headers.authorization;
    })
    .get(/\/xyz/)
    .reply(404, '404')
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
    .get(/\/apiautherror/)
    .reply(401, '401')
    .post(/\/apiautherror/)
    .reply(401, '401')
    .post(/^(?!.*xyz).*$/)
    .reply(200, (uri, requestBody) => {
      switch (uri) {
        case '/api/v1/':
          return requestBody;
        case '/api/v1/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues':
          return fs.readFileSync(
            fixturesFolderPath + 'apiResponses/projectIssues.json',
          );
        default:
      }
    })
    .get(/\/api\/v1\/dummypath/)
    .delay(1000)
    .reply(200, () => {
      return 'dummypath slowed down';
    })
    .get(/^(?!.*xyz).*$/)
    .reply(200, (uri) => {
      switch (uri) {
        case '/api/v1/':
          return fs.readFileSync(
            fixturesFolderPath + 'apiResponses/general-doc.json',
          );
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
});

describe('Testing Request Flows', () => {
  const requestManager = new requestsManager();
  it('Single Sync request', async () => {
    try {
      const responseSync = await requestManager.request({
        verb: 'GET',
        url: '/',
      });
      const fixturesJSON = JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
          .toString(),
      );

      expect(_.isEqual(responseSync.data, fixturesJSON)).toBeTruthy();
    } catch (err) {
      throw new Error(err);
    }
  });

  it('2 successive Sync requests', async () => {
    try {
      const responseSync1 = await requestManager.request({
        verb: 'GET',
        url: '/',
      });
      const responseSync2 = await requestManager.request({
        verb: 'GET',
        url: '/',
      });
      const fixturesJSON = JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
          .toString(),
      );

      expect(_.isEqual(responseSync1.data, fixturesJSON)).toBeTruthy();
      expect(_.isEqual(responseSync2.data, fixturesJSON)).toBeTruthy();
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  });

  it('Single Sync request fail not found', async () => {
    try {
      await requestManager.request({ verb: 'GET', url: '/xyz' });
    } catch (err) {
      expect(err).toBeInstanceOf(RequestsManagerNotFoundError);
    }
  });

  it('Bulk Requests Array Sync request', async () => {
    try {
      // dummypath is slowed down 1sec to verify that the response array respect the order of request
      // waits for all request to be done and return an array of response in the same order.
      const results: Array<any> = await requestManager.requestBulk([
        { verb: 'GET', url: '/dummypath' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
          body: '{}',
        },
        { verb: 'GET', url: '/' },
      ]);
      const fixturesJSON1 = JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
          .toString(),
      );
      const fixturesJSON2 = JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/projectIssues.json')
          .toString(),
      );

      expect(results[0].data).toEqual('dummypath slowed down');
      expect(_.isEqual(results[2].data, fixturesJSON1)).toBeTruthy();
      expect(_.isEqual(results[1].data, fixturesJSON2)).toBeTruthy();
    } catch (resultsWithError) {
      console.log(resultsWithError);
    }
  });

  it('Bulk Requests Array Sync request fail not found', async () => {
    try {
      // xyz serves 404, expecting to return an array with error in it.
      await requestManager.requestBulk([
        { verb: 'GET', url: '/xyz' },
        { verb: 'GET', url: '/dummypath' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
          body: '{}',
        },
      ]);
    } catch (resultsWithError) {
      const fixturesJSON2 = JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/projectIssues.json')
          .toString(),
      );
      expect(_.isEqual(resultsWithError[2].data, fixturesJSON2)).toBeTruthy();
      expect(resultsWithError[1].data).toEqual('dummypath slowed down');
      expect(resultsWithError[0]).toBeInstanceOf(RequestsManagerNotFoundError);
    }
  });

  it('Request Stream request return as soon as done', async (done) => {
    const responseMap = new Map();

    const expectedResponse = [
      {
        'what orgs can the current token access?':
          'https://snyk.io/api/v1/orgs',
        'what projects are owned by this org?':
          'https://snyk.io/api/v1/org/:id/projects',
        'test a package for issues':
          'https://snyk.io/api/v1/test/:packageManager/:packageName/:packageVersion',
      },

      'dummypath slowed down',

      JSON.parse(
        fs
          .readFileSync(fixturesFolderPath + 'apiResponses/projectIssues.json')
          .toString(),
      ),
    ];

    requestManager.on('data', {
      callback: (requestId, data) => {
        responseMap.set(requestId, data);

        if (
          Array.from(responseMap.values()).filter((value) => value != '')
            .length == 3
        ) {
          try {
            Array.from(responseMap.values()).forEach((response, index) => {
              expect(response.data).toEqual(expectedResponse[index]);
            });
            done();
          } catch (err) {
            done(err);
          }
        }
      },
      channel: 'test-channel',
    });
    requestManager.on('error', {
      callback: () => {
        done.fail();
      },
    });

    try {
      responseMap.set(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
        '',
      );
      responseMap.set(
        requestManager.requestStream(
          { verb: 'GET', url: '/dummypath', body: '' },
          'test-channel',
        ),
        '',
      );
      responseMap.set(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
        '',
      );
    } catch (err) {
      console.log(err);
    }
  });

  it('Single Sync request with no token override', async () => {
    process.env.SNYK_TOKEN = '123';
    try {
      const responseSync = await requestManager.request({
        verb: 'GET',
        url: '/customtoken',
      });
      expect(responseSync.data).toEqual('token 123');
    } catch (err) {
      throw new Error(err);
    }
  });
});

describe('Testing Request Flows', () => {
  const requestManager = new requestsManager({ snykToken: '0987654321' });
  it('Single Sync request with token override', async () => {
    try {
      const responseSync = await requestManager.request({
        verb: 'GET',
        url: '/customtoken',
      });

      expect(responseSync.data).toEqual('token 0987654321');
    } catch (err) {
      throw new Error(err);
    }
  });
});
