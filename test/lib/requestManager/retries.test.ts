import { requestsManager } from '../../../src/lib/request/requestManager';
import * as fs from 'fs';
import * as nock from 'nock';
import * as path from 'path';
import { RequestsManagerApiError } from '../../../src/lib/customErrors/requestManagerErrors';

const fixturesFolderPath = path.resolve(__dirname, '../..') + '/fixtures/';

const requestManager = new requestsManager();

describe('Testing Request Retries', () => {
  it('Retry on 500 - success after 1 retry', async () => {
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(200, () => {
        return fs.readFileSync(
          fixturesFolderPath + 'apiResponses/general-doc.json',
        );
      });

    try {
      const response = await requestManager.request({
        verb: 'POST',
        url: '/apierror',
      });
      expect(response.data).toEqual(
        JSON.parse(
          fs
            .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
            .toString(),
        ),
      );
    } catch (err) {
      console.log(err);
    }
  });

  it('Retry on 500 - success after 4 retries', async () => {
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(200, () => {
        return fs.readFileSync(
          fixturesFolderPath + 'apiResponses/general-doc.json',
        );
      });

    try {
      const response = await requestManager.request({
        verb: 'POST',
        url: '/apierror',
      });
      expect(response.data).toEqual(
        JSON.parse(
          fs
            .readFileSync(fixturesFolderPath + 'apiResponses/general-doc.json')
            .toString(),
        ),
      );
    } catch (err) {
      console.log(err);
    }
  });

  it('Retry on 500 - fail after 5 retries', async () => {
    let hasReached5thTime = false;
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, '500');
    nock('https://api.snyk.io')
      .post(/\/apierror/)
      .reply(500, () => {
        hasReached5thTime = true;
        return '500';
      });

    try {
      const response = await requestManager.request({
        verb: 'POST',
        url: '/apierror',
      });
      expect(response.data).toThrowError();
    } catch (err) {
      expect(err).toBeInstanceOf(RequestsManagerApiError);
      expect(hasReached5thTime).toBeTruthy();
    }
  });
});
