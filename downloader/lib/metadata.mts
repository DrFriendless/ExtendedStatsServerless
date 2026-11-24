// data shared by both the CDK script and the post-stack SDK script.

import {Duration} from "aws-cdk-lib";

export const DEPLOYMENT_BUCKET = "extstats-deployment";
export const CACHE_BUCKET = "extstats-cache";
export const COMPONENT = "downloader";
export const REGION = "ap-southeast-2";
export const PROFILE = "drfriendless";

export interface LambdaSpec {
    name: string;
    handler: string;
    duration: number;
    mem: number;
    maxConcurrency: number | undefined;
    durableConfig?: { executionTimeout: Duration };
}

export const LAMBDA_SPECS: LambdaSpec[] = [
    // invoked on a schedule
    { name: `${COMPONENT}_processUserList`, handler: "functions.processUserList", duration: 60, mem: 128, maxConcurrency: 1 },
    // invoked on a schedule
    { name: `${COMPONENT}_processMetadata`, handler: "functions.processMetadata", duration: 60, mem: 128, maxConcurrency: 1 },
    // not invoked because we don't know how to write the code.
    { name: `${COMPONENT}_processBGGTop50`, handler: "functions.processBGGTop50", duration: 40, mem: 128, maxConcurrency: undefined },
    // new architecture
    { name: `${COMPONENT}_prehandle`, handler: "newarch.prehandle", duration: 40, mem: 128, maxConcurrency: undefined },
    // ..complete.. functions are invoked as continuations from the download function (in Rust).
    { name: `${COMPONENT}_completeProcessUser`, handler: "newarch.completeProcessUser", duration: 10, mem: 128, maxConcurrency: undefined },
    { name: `${COMPONENT}_completeProcessDesigner`, handler: "newarch.completeProcessDesigner", duration: 10, mem: 128, maxConcurrency: undefined },
    { name: `${COMPONENT}_completeProcessPublisher`, handler: "newarch.completeProcessPublisher", duration: 10, mem: 128, maxConcurrency: undefined },
    { name: `${COMPONENT}_completeProcessGame`, handler: "newarch.completeProcessGame", duration: 10, mem: 128, maxConcurrency: undefined },
    { name: `${COMPONENT}_completeProcessCollection`, handler: "newarch.completeProcessCollection", duration: 100, mem: 256, maxConcurrency: undefined },
    { name: `${COMPONENT}_completeProcessPlays`, handler: "newarch.completeProcessPlays", duration: 100, mem: 256, maxConcurrency: undefined },
    // invoked directly from prehandle.
    { name: `${COMPONENT}_processPlayedYears`, handler: "newarch.handleUpdatePlayedYears", duration: 10, mem: 128, maxConcurrency: undefined },
];

// Lambdas which run in the VPC.
export const INSIDE_LAMBDA_SPECS: LambdaSpec[] = [
    { name: `${COMPONENT}_insideStartTasks`, handler: "newinside.handleStartTasks", duration: 10, mem: 128, maxConcurrency: undefined },
    { name: `${COMPONENT}_insideWriteResults`, handler: "newinside.handleWriteResult", duration: 30, mem: 256, maxConcurrency: 1 },
];