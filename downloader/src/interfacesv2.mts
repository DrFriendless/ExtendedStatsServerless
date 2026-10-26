export interface URLRequest {
    url: string;
    bggApiKey: string;
    notBefore?: number;
}

// properties common to all download requests
export interface AbstractDownloadRequest {
    requestId: string;
    requests: URLRequest[];
    attempts: number;
}

// info to send the DownloadResult to a callback
export interface CallbackDownloadRequest extends AbstractDownloadRequest {
    type: "callback";
    callbackId: string;
}

// info to send the DownloadResult to a function invocation
export interface ContinuationDownloadRequest extends AbstractDownloadRequest {
    type: "continuation";
    functionName: string;
    continuationData: any;
}

export type DownloadRequest = CallbackDownloadRequest | ContinuationDownloadRequest;

export interface AbstractDownloadResult {
    url: string;
}

// we stored the data on S3
export interface S3DownloadResultType extends AbstractDownloadResult {
    type: "s3";
    bucket: string;
    objectKey: string;
}

// here is the complete data
export interface ContentDownloadResultType extends AbstractDownloadResult {
    type: "content";
    content: string;
}

// there was some sort of failure.
export interface FailureDownloadResultType extends AbstractDownloadResult {
    type: "failure";
    error: string;
}

export type DownloadResult = S3DownloadResultType | ContentDownloadResultType | FailureDownloadResultType;

export interface AbstractDownloadResponse {
    attempts: number;
    results: DownloadResult[];
    requestId: string;
}

// This is what we will send to a callback
export interface CallbackDownloadResponse extends AbstractDownloadResponse {
}

// This is what we will send to a newly invoked function.
export interface ContinuationDownloadResponse extends AbstractDownloadResponse {
    continuationData: any;
}
