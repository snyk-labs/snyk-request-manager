import { requestsManager } from './request/requestManager'

const run = async () => {
  const manager = new requestsManager()
  manager.on('data', {
                      callback:(requestId, data) => {
                          console.log("response for request ", requestId)
                          console.log(data)
                      }
  })

  manager.on('error', {
          callback:(requestId, data) => {
              console.log("response for request ", requestId)
              console.log(data)
          }
  })

  try{
      let requestSync = await manager.request({verb: "GET", url: '/', body: ''})
      console.log(requestSync)
      console.log('done with synced request')
  } catch (err) {
      console.log('error')
      console.log(err)
  }


  manager.on('data', {
      callback:(requestId, data) => {
          console.log("response for request on test-channel ", requestId)
          console.log(data)
      },
      channel: 'test-channel'
  })

  try {
   console.log('1',manager.requestStream({verb: "GET", url: '/', body: ''}))
   console.log('1-channel',manager.requestStream({verb: "GET", url: '/', body: ''}, 'test-channel'))
   console.log('2',manager.requestStream({verb: "GET", url: '/', body: ''}))
   console.log('2-channel',manager.requestStream({verb: "GET", url: '/', body: ''}, 'test-channel'))
   console.log('3',manager.requestStream({verb: "GET", url: '/', body: ''}))
   console.log('3-channel',manager.requestStream({verb: "GET", url: '/', body: ''}, 'test-channel'))
  } catch (err) {
      console.log(err)
  }


  

  const filters = `{
      "filters": {
          "severities": [
            "critical",  
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
      const results = await manager.requestBulk([{verb: "GET", url: '/', body: ''}, {verb: "POST", url: '/org/334e0c45-5d3d-40f6-b882-ae82a164b317/project/0bbbfee1-2138-4322-80d4-4166d1259ae5/issues', body: filters}, {verb: "GET", url: '/', body: ''}])
      console.log(results)
  } catch(resultsWithError) {
      console.log(resultsWithError)
  }
  
}

run()
