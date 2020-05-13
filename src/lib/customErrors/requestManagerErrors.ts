import {ApiError} from './apiError'

const requestsManagerErrorOverload = (err: Error, channel: string, requestId: string): Error => {
    switch(err?.name){
        case 'ApiError':
            return new RequestsManagerApiError(err.message, channel, requestId)
        case 'ApiAuthenticationError':
            return new RequestsManagerApiAuthenticationError(err.message, channel, requestId)
        case 'NotFoundError':
            return new RequestsManagerNotFoundError(err.message, channel, requestId)
        case 'Unknown':
            return new RequestsManagerGenericError(err.message, channel, requestId)
            break;
        default:
    }       return new RequestsManagerGenericError("Unclassified", channel, requestId)
}

class RequestsManagerApiError extends ApiError {
    channel: string
    requestId: string
    constructor(message: any, channel: string, requestId: string){
        super(message)
        this.name = "ApiError"
        this.channel = channel
        this.requestId = requestId
        this.message = (message || "")
    }
}

class RequestsManagerApiAuthenticationError extends ApiError {
    channel: string
    requestId: string
    constructor(message: any, channel: string, requestId: string){
        super(message)
        this.name = "ApiAuthenticationError"
        this.channel = channel
        this.requestId = requestId
        this.message = (message || "")
    }
}

class RequestsManagerNotFoundError extends ApiError {
    channel: string
    requestId: string
    constructor(message: any, channel: string, requestId: string){
        super(message)
        this.name = "NotFoundError"
        this.channel = channel
        this.requestId = requestId
        this.message = (message || "")
    }
}

class RequestsManagerGenericError extends ApiError {
    channel: string
    requestId: string
    constructor(message: any, channel: string, requestId: string){
        super(message)
        this.name = "Unknown"
        this.channel = channel
        this.requestId = requestId
        this.message = (message || "")
    }
}

export {
    RequestsManagerApiError,
    RequestsManagerApiAuthenticationError,
    RequestsManagerNotFoundError,
    RequestsManagerGenericError,
    requestsManagerErrorOverload
}