const Configstore = require('@snyk/configstore');
import axios from 'axios';
import * as Error from '../customErrors/apiError'

// Fixes issue https://github.com/axios/axios/issues/3384
// where HTTPS over HTTP Proxy Fails with 500 handshakefailed on mcafee proxy
import 'global-agent/bootstrap';

interface SnykRequest {
    verb: string,
    url: string,
    body?: string,
    headers?: Object,
    requestId?: string
}

const getTopParentModuleName = (parent: NodeModule | null): string => {
    if(parent == null){
        return ''
    }
    if(parent?.parent){
        return getTopParentModuleName(parent.parent)
    } else {
        return parent?.paths[0].split('/')[parent.paths[0].split('/').length-2]+'/' as string
    }
}

const makeSnykRequest = async (request: SnykRequest, snykToken: string = '', userAgentPrefix:string = '') => {
    const userConfig = getConfig()
    const token = snykToken == '' ? userConfig.token : snykToken

    const topParentModuleName = getTopParentModuleName(module.parent as any)
    const userAgentPrefixChecked = userAgentPrefix != '' && !userAgentPrefix.endsWith('/') ? userAgentPrefix+'/': userAgentPrefix
    const requestHeaders: Object = {
        'Content-Type': 'application/json',
        'Authorization': 'token '+ token,
        'User-Agent': `${topParentModuleName}${userAgentPrefixChecked}tech-services/snyk-request-manager/1.0`
    }

    const apiClient = axios.create({
        baseURL: userConfig.endpoint,
        responseType: 'json',
        headers: {...requestHeaders, ...request.headers }
      });

    try {
        let res;
        switch(request.verb.toUpperCase()){
            case "GET":
                res = await apiClient.get(request.url)
                break;
            case "POST":
                res = await apiClient.post(request.url,request.body)
                break;
            case "PUT":
                res = await apiClient.put(request.url,request.body)
                break;
            case "DELETE":
                res = await apiClient.delete(request.url)
                break;
            default:
                throw new Error.GenericError('Unexpected http command')
        }
        return res
    } catch (err) {
        switch(err.response?.status){
            case 401:
                throw new Error.ApiAuthenticationError(err)
            case 404:
                throw new Error.NotFoundError(err)
            case 500:
                throw new Error.ApiError(err)
            default:
                throw new Error.GenericError(err)
        }
    }


}

const getConfig = (): {endpoint: string, token: string} => {
    const snykApiEndpoint: string = process.env.SNYK_API || new Configstore('snyk').get('endpoint') || 'https://snyk.io/api/v1'
    const snykToken = process.env.SNYK_TOKEN || new Configstore('snyk').get('api')
    return {endpoint: snykApiEndpoint, token: snykToken}
}

export {
    makeSnykRequest,
    getConfig,
    SnykRequest as snykRequest
}
