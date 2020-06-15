

class ApiError extends Error {
    data: {}
    constructor(message: any){
        super(message)
        this.name = "ApiError"
        this.message = (message || "")
        this.data = (message.response?.data || "")
    }
}

class ApiAuthenticationError extends Error {
    data: {}
    constructor(message: any){
        super(message)
        this.name = "ApiAuthenticationError"
        this.message = (message || "")
        this.data = (message.response?.data || "")
    }
}

class NotFoundError extends Error {
    data: {}
    constructor(message: any){
        super(message)
        this.name = "NotFoundError"
        this.message = (message || "")
        this.data = (message.response?.data || "")
    }
}

class GenericError extends Error {
    data: {}
    constructor(message: any){
        super(message)
        this.name = "Unknown"
        this.message = (message || "")
        this.data = (message.response?.data || "")
    }
}

export {
    ApiError,
    ApiAuthenticationError,
    NotFoundError,
    GenericError
}