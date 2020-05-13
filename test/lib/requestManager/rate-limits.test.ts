import { requestsManager } from '../../../src/lib/request/requestManager';
import * as fs from 'fs';
import * as nock from 'nock';
import * as path from 'path';

const fixturesFolderPath = path.resolve(__dirname, '../..') + '/fixtures/';
beforeAll(() => {
  return nock('https://snyk.io')
    .persist()
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

describe('Testing Request Rate limiting', () => {
  describe('Testing Sync requests', () => {
    it('Overall rate limiting in sync requests - burst size 1', async () => {
      const requestManager = new requestsManager(1, 200);
      const t0 = Date.now();

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(600);
      expect(t1 - t0).toBeLessThan(800);
    });

    it('Overall rate limiting in sync requests - burst size 1 - with slow request', async () => {
      const requestManager = new requestsManager(1, 200);
      const t0 = Date.now();

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/dummypath' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(1400);
      expect(t1 - t0).toBeLessThan(1600);
    });

    it('Overall rate limiting in sync requests - burst size 2', async () => {
      const requestManager = new requestsManager(2, 200);
      const t0 = Date.now();

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(400);
      expect(t1 - t0).toBeLessThan(600);
    });

    it('Overall rate limiting in sync requests - burst size 4', async () => {
      const requestManager = new requestsManager(4, 200);
      const t0 = Date.now();

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });
      const t1 = Date.now();

      expect(t1 - t0).toBeLessThan(200);
    });

    it('Overall rate limiting in bulk sync requests - burst size 1', async () => {
      const requestManager = new requestsManager(1, 200);
      const t0 = Date.now();

      await requestManager.requestBulk([
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
        },
      ]);
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(600);
      expect(t1 - t0).toBeLessThan(800);
    });

    it('Overall rate limiting in bulk sync requests - burst size 1 with slow request', async () => {
      const requestManager = new requestsManager(1, 200);
      const t0 = Date.now();

      await requestManager.requestBulk([
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/dummypath' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
        },
      ]);
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(1400);
      expect(t1 - t0).toBeLessThan(1600);
    });

    it('Overall rate limiting in bulk sync requests - burst size 2', async () => {
      const requestManager = new requestsManager(2, 200);
      const t0 = Date.now();

      await requestManager.requestBulk([
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
        },
      ]);
      const t1 = Date.now();
      expect(t1 - t0).toBeGreaterThan(400);
      expect(t1 - t0).toBeLessThan(600);
    });

    it('Overall rate limiting in bulk sync requests - burst size 4', async () => {
      const requestManager = new requestsManager(4, 200);
      const t0 = Date.now();

      await requestManager.requestBulk([
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
        },
      ]);
      const t1 = Date.now();

      expect(t1 - t0).toBeLessThan(200);
    });
  });

  describe('Testing Stream requests', () => {
    it('Overall rate limiting in sync requests - burst size 1', async (done) => {
      const requestManager = new requestsManager(1, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);

          if (responseIdArray.length == 0) {
            const t1 = Date.now();
            expect(t1 - t0).toBeGreaterThan(600);
            expect(t1 - t0).toBeLessThan(800);

            done();
          }
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
    });

    it('Overall rate limiting in sync requests - burst size 1 with slow request', async (done) => {
      const requestManager = new requestsManager(1, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);
          if (responseIdArray.length == 0) {
            const t1 = Date.now();
            try {
              expect(t1 - t0).toBeGreaterThan(1200);
              expect(t1 - t0).toBeLessThan(1400);
            } catch (err) {
              done(err);
            }
            done();
          }
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/dummypath', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
    });

    it('Overall rate limiting in sync requests - burst size 2', async (done) => {
      const requestManager = new requestsManager(2, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);

          if (responseIdArray.length == 0) {
            const t1 = Date.now();
            expect(t1 - t0).toBeGreaterThan(400);
            expect(t1 - t0).toBeLessThan(600);

            done();
          }
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
    });

    it('Overall rate limiting in sync requests - burst size 4', async (done) => {
      const requestManager = new requestsManager(4, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);

          if (responseIdArray.length == 0) {
            const t1 = Date.now();
            expect(t1 - t0).toBeGreaterThan(0);
            expect(t1 - t0).toBeLessThan(200);

            done();
          }
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
    });
  });

  describe('Testing Stream + Sync requests', () => {
    it('Overall rate limiting in mixed (sync+stream) requests - burst size 1', async (done) => {
      const requestManager = new requestsManager(1, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });

      if (responseIdArray.length == 0) {
        const t1 = Date.now();
        expect(t1 - t0).toBeGreaterThan(1400);
        expect(t1 - t0).toBeLessThan(1600);
        done();
      } else {
        done.fail();
      }
    });

    it('Overall rate limiting in mixed (sync+stream) requests - burst size 2', async (done) => {
      const requestManager = new requestsManager(2, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });

      if (responseIdArray.length == 0) {
        const t1 = Date.now();
        expect(t1 - t0).toBeGreaterThan(1200);
        expect(t1 - t0).toBeLessThan(1400);
        done();
      } else {
        done.fail();
      }
    });

    it('Overall rate limiting in mixed (sync+stream) requests - burst size 4', async (done) => {
      const requestManager = new requestsManager(4, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });

      if (responseIdArray.length == 0) {
        const t1 = Date.now();
        expect(t1 - t0).toBeGreaterThan(800);
        expect(t1 - t0).toBeLessThan(1000);
        done();
      } else {
        done.fail();
      }
    });

    it('Overall rate limiting in mixed (sync+bulk+stream) requests - burst size 4', async (done) => {
      const requestManager = new requestsManager(4, 200);
      const responseIdArray: Array<string> = [];
      const t0 = Date.now();

      requestManager.on('data', {
        callback: (requestId) => {
          responseIdArray.splice(responseIdArray.indexOf(requestId), 1);
        },
        channel: 'test-channel',
      });

      requestManager.on('error', {
        callback: () => {
          done.fail();
        },
      });

      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          { verb: 'GET', url: '/', body: '' },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );
      responseIdArray.push(
        requestManager.requestStream(
          {
            verb: 'POST',
            url:
              '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
            body: '{}',
          },
          'test-channel',
        ),
      );

      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({ verb: 'GET', url: '/' });
      await requestManager.request({
        verb: 'POST',
        url:
          '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
      });

      await requestManager.requestBulk([
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        { verb: 'GET', url: '/' },
        {
          verb: 'POST',
          url:
            '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues',
        },
      ]);

      if (responseIdArray.length == 0) {
        const t1 = Date.now();
        expect(t1 - t0).toBeGreaterThan(1600);
        expect(t1 - t0).toBeLessThan(1800);
        done();
      } else {
        done.fail();
      }
    });
  });
  // it('Burst size respected', async () => {
  //     const requestManager = new requestsManager(2,200)

  // })
});
