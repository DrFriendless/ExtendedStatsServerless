// data shared by both the CDK script and the post-stack SDK script.

export const DEPLOYMENT_BUCKET = "extstats-deployment";
export const COMPONENT = "downloader";
export const REGION = "ap-southeast-2";
export const PROFILE = "drfriendless";

export interface LambdaSpec {
    name: string;
    handler: string;
    duration: number;
    maxConcurrency: number | undefined;
}

export const LAMBDA_SPECS: LambdaSpec[] = [
    { name: `${COMPONENT}_processUserList`, handler: "functions.processUserList", duration: 60, maxConcurrency: 1 },
    { name: `${COMPONENT}_processUser`, handler: "functions.processUser", duration: 60, maxConcurrency: undefined },
    { name: `${COMPONENT}_processCollection`, handler: "functions.processCollection", duration: 60, maxConcurrency: undefined },
    { name: `${COMPONENT}_processGame`, handler: "functions.processGame", duration: 60, maxConcurrency: undefined },
    { name: `${COMPONENT}_processPlayed`, handler: "functions.processPlayed", duration: 900, maxConcurrency: 1 },
];

