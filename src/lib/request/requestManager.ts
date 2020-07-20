import { LeakyBucketQueue } from 'leaky-bucket-queue';
import { snykRequest, makeSnykRequest } from './request'
import { v4 as uuidv4 } from 'uuid';
import * as requestsManagerError from '../customErrors/requestManagerErrors'

interface queuedRequest {
    id: string,
    channel: string,
    snykRequest: snykRequest
}
interface queueCallbackListenerBundle {
    callback(requestId: string, data: any): void,
    channel?: string
}
enum eventType {
    data = "data",
    error = "error",
}
interface responseEvent {
    eventType: eventType,
    channel: string,
    requestId: string,
    data: any
}

interface requestsManagerParams {
    snykToken?: string,
    burstSize?: number,
    period?: number,
    maxRetryCount?: number,
    userAgentPrefix?: string
}

class requestsManager {
    _requestsQueue: LeakyBucketQueue<queuedRequest>
    // TODO: Type _events rather than plain obscure object structure
    _events: any
    _retryCounter: Map<string,number>
    _MAX_RETRY_COUNT: number
    _snykToken: string
    _userAgentPrefix: string

    //snykToken = '', burstSize = 10, period = 500, maxRetryCount = 5
    constructor(params: requestsManagerParams = {}) {
        this._requestsQueue = new LeakyBucketQueue<queuedRequest>({ burstSize: params?.burstSize || 10, period: params?.period || 500  });
        this._setupQueueExecutors(this._requestsQueue)
        this._events = {}
        this._retryCounter = new Map()
        this._MAX_RETRY_COUNT = params?.maxRetryCount || 5
        this._snykToken = params?.snykToken || ''
        this._userAgentPrefix = params?.userAgentPrefix || ''
    }

    _setupQueueExecutors = (queue: LeakyBucketQueue<queuedRequest>) => {
        queue.consume().subscribe({
            next: this._makeRequest,
            error: this._queueErrorHandler,
            complete: () => {
                console.log("Stopped queue")
            }
        })  
    }

    _makeRequest = async (request: queuedRequest) => {
        let requestId = request.id
        try {
            let response = await makeSnykRequest(request.snykRequest, this._snykToken, this._userAgentPrefix)
            this._emit({eventType: eventType.data, channel: request.channel, requestId: requestId, data: response })
        } catch (err) {
            let overloadedError = requestsManagerError.requestsManagerErrorOverload(err, request.channel, requestId)
            let alreadyRetriedCount = this._retryCounter.get(requestId) || 0
            if(alreadyRetriedCount >= this._MAX_RETRY_COUNT){
                this._emit({eventType: eventType.error, channel: request.channel, requestId: requestId, data: overloadedError })
            } else {
                this._retryCounter.set(requestId, alreadyRetriedCount+1)
                // Throw it back into the queue
                this.requestStream(request.snykRequest,request.channel, request.id)
            }
            
            
        }
        
    }

    _queueErrorHandler = (err: Error) => {
        //debug(err)
        // TODO: Add retry logic
        // Track request ID count and throw it back into the queue
        // Throw error when count > MAX_RETRIES_LIMIT
        throw new Error(err.stack)
    }

    
    _emit = (response: responseEvent) => {
        if (!this._events[response.eventType]) {
            throw new Error(`Can't emit an event. Event "${eventType}" doesn't exits.`);
        }

        const fireCallbacks = (listenerBundle: queueCallbackListenerBundle) => {
            if(response.channel == listenerBundle.channel){
                
                listenerBundle.callback(response.requestId, response.data);
            }
            
        };

        this._events[response.eventType].forEach(fireCallbacks);
    }

    _removeAllListenersForChannel = (channel: string) => {
        Object.keys(eventType).forEach(typeOfEvent => {
            if (!this._events[typeOfEvent]) {
                throw new Error(`Can't remove a listener. Event "${typeOfEvent}" doesn't exits.`);
            }
            const filterListeners = (callbackListener: queueCallbackListenerBundle) => callbackListener.channel !== channel;
      
            this._events[typeOfEvent] = this._events[typeOfEvent].filter(filterListeners);
        })    
    }

    _doesChannelHaveListeners = (channel: string) => {
        let dataEventListeners = this._events['data'] as Array<queueCallbackListenerBundle>
        return dataEventListeners.some(listener => listener.channel == channel)
    }
    
    request = (request: snykRequest): Promise<any> => {
        return new Promise((resolve,reject) => {
            let syncRequestChannel = uuidv4()
           
            const callbackBundle = {
                                        callback: (originalRequestId: string, data: any) => {
                                            if(requestId == originalRequestId){
                                                this._removeAllListenersForChannel(syncRequestChannel)
                                                resolve(data)
                                            }
                                        },
                                        channel: syncRequestChannel
                                    }
            const errorCallbackBundle = {
                                            callback:(originalRequestId: string, data: any) => {
                                                if(requestId == originalRequestId){
                                                    this._removeAllListenersForChannel(syncRequestChannel)
                                                    reject(data)
                                                }
                                            },
                                            channel: syncRequestChannel
                                        }

            this.on('data', callbackBundle)
            this.on('error', errorCallbackBundle)
            let requestId = this.requestStream(request, syncRequestChannel)
        })
              
    }
    
    
    requestBulk = (snykRequestsArray: Array<snykRequest>): Promise<Array<Object>> => {
        return new Promise((resolve,reject) => {
            // Fire off all requests in Array and return only when responses are all returned
            // Must return array of responses in the same order.
            let requestsMap: Map<string,Object> = new Map()
            let bulkRequestChannel = uuidv4()
            let isErrorInAtLeastOneRequest = false
            let requestRemainingCount = snykRequestsArray.length
            const callbackBundle = {
                callback: (originalRequestId: string, data: any) => {
                    requestsMap.set(originalRequestId, data)
                    requestRemainingCount--
                    if(requestRemainingCount <= 0){
                        let responsesArray: Array<Object> = []
                        requestsMap.forEach((value) => {
                            responsesArray.push(value)
                        })
                        isErrorInAtLeastOneRequest? reject(responsesArray) : resolve(responsesArray)
                    }
                },
                channel: bulkRequestChannel
            }
            const errorCallbackBundle = {
                callback:(originalRequestId: string, data: any) => {
                    isErrorInAtLeastOneRequest = true
                    callbackBundle.callback(originalRequestId,data)
                },
                channel: bulkRequestChannel
            }

            this.on('data', callbackBundle)
            this.on('error', errorCallbackBundle)

            snykRequestsArray.forEach(snykRequest => {
                requestsMap.set(this.requestStream(snykRequest, bulkRequestChannel), {})
            })
        })
    }

    requestStream = (request: snykRequest, channel: string = 'stream', id: string = ''): string => {
        let requestId = id ? id : uuidv4()
        let requestForQueue: queuedRequest = {id: requestId, channel: channel, snykRequest: request}
        this._requestsQueue.enqueue(requestForQueue)
        if(!this._doesChannelHaveListeners(channel)){
            throw new Error(`Not listener(s) setup for channel ${channel}`)
        }
        return requestId
    }
    


    on = (eventType: string, listenerBundle: queueCallbackListenerBundle) => {
        if (!this._events[eventType]) {
            this._events[eventType] = [];
        }
        if(!listenerBundle.channel) {
            listenerBundle.channel = 'stream'
        }
        this._events[eventType].push(listenerBundle);
    }

}


export {
    requestsManager
}
    





