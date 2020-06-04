![Snyk logo](https://snyk.io/style/asset/logo/snyk-print.svg)

***

[![Known Vulnerabilities](https://snyk.io/test/github/snyk-tech-services/snyk-request-manager/badge.svg)](https://snyk.io/test/github/snyk-tech-services/snyk-request-manager)

Snyk helps you find, fix and monitor for known vulnerabilities in your dependencies, both on an ad hoc basis and as part of your CI (Build) system.

## Snyk snyk-request-manager
Rate controlled and retry enabled request manager to interact with Snyk APIs.\
No matter with request mode you decide to use, using the same client will ensure all requests are funneled through a leaky bucket style queue allowing specific burst and interval of requests.

Specific your queue settings in the constructor.

Failed requests will be put back into queue for retry till maximum number of attempts has been reached, in which case error will be thrown.

## Installation
`npm install snyk-request-manager`

## Usage

Check out available endpoints there => https://snyk.docs.apiary.io/#reference\
Any url used below omits the API base (https://snyk.io/api/v1):\
Example for Base documentation endpoint:
* `GET` request on `https://snyk.io/api/v1/`
* await requestManager.request({verb: "GET", url: '/'})

### 0 - Setup your Snyk details if not already done
Following the same setup as snyk CLI, it uses the token stored in your system after a `snyk auth` or defined via env var `SNYK_TOKEN`.
\
Same thing if you need to designate a different API base url to your onprem instance via `snyk config set endpoint` or `SNYK_API` to `https://yourhostname/api`

>Make sure to omit the base endpoint url when you define url to hit.

### 1 - Construct your manager


    const requestManager = new requestsManager()

Default values if using `new requestsManager()`\
    `requestsManager(snykToken = '', burstSize = 10, period = 500, maxRetryCount = 5)`



### 2 - Single shot request
Fire off your request and await it's result.

    import { requestsManager } from 'snyk-request-manager';

    const run = async () => {
        const requestManager = new requestsManager();

        // Fire off single shot request
        try{
        let requestSync = await requestManager.request({verb: "GET", url: '/url'})
        console.log(requestSync.data)
        } catch (err) {
            console.log(err)
        }
    }

    run()


### 3 - Bulk requests burst
Fire off you array of requests, await for all of them to complete to receive results in an Array in the same order.
If some requests fails, retrieve the results in the catch, requests completed successfully will have the results.

    import { requestsManager } from 'snyk-request-manager';

    const run = async () => {
        const requestManager = new requestsManager();

        // Fire off single shot request
        try{
        let requestSync = await requestManager.request({verb: "GET", url: '/url'})
        console.log(requestSync.data)
        } catch (err) {
            console.log(err)
        }

        // Fire off multiple requests async/await
        const filters = `{
        "filters": {
            "severities": [
                "high",
                "medium",
                "low"
            ],
            "exploitMaturity": [
                "mature",
                "proof-of-concept",
                "no-known-exploit",
                "no-data"
            ],
            "types": [
                "vuln",
                "license"
            ],
            "ignored": false
                }
            }
            `
        try {
        const results = await requestManager.requestBulk([
                                                {verb: "GET", url: '/'},
                                                {verb: "POST", url: '/org/:orgID/project/:projectId/issues', body: filters },
                                                {verb: "GET", url: '/user/:id'}])
        console.log(results)
        } catch(resultsWithError) {
            console.log(resultsWithError)
        }


    }

    run()



### 4 - Stream mode requests

Define you listeners `data` and `error` to listen on your channel only.
Define as many listeners as needed to use multiple parallel streams.
If not defining custom channel name, default channel name is used in the backend `stream`


    requestManager.on('data', {
        callback:(requestId, data) => {
            console.log("response for request on test-channel ", requestId)
            console.log(data.data)
        },
        channel: 'test-channel'
    })

    try {
    requestManager.requestStream({verb: "GET", url: '/user/:id'}))
    requestManager.requestStream({verb: "GET", url: '/'}, 'test-channel')
    } catch (err) {
        console.log(err)
    }


Above will only show result of call to `/` as listener is only for 'test-channel'


### Customize token and or snyk token
While instantiating your manager

#### Customize queue size and intervals
```
const requestManager = new requestsManager('',20, 100, 10)
```

#### Customize snyk token
```
const requestManager = new requestsManager('21346-1234-1234-1234')
```

#### Customize snyk token and queue|intervals|retries
```
const requestManager = new requestsManager('21346-1234-1234-1234',20, 100, 10)
```