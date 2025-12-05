// data shared by both the CDK script and the post-stack SDK script.

export const DEPLOYMENT_BUCKET = "extstats-deployment";
export const COMPONENT = "downloader";
export const REGION = "ap-southeast-2";
export const PROFILE = "drfriendless";

export interface LambdaSpec {
    name: string;
    handler: string;
    maxConcurrency: number | undefined;
}

export const LAMBDA_SPECS: LambdaSpec[] = [
    { name: `${COMPONENT}_processUserList`, handler: "functions.processUserList", maxConcurrency: 1 },
    { name: `${COMPONENT}_processUser`, handler: "functions.processUser", maxConcurrency: undefined },
    { name: `${COMPONENT}_processCollection`, handler: "functions.processCollection", maxConcurrency: undefined },
    { name: `${COMPONENT}_processGame`, handler: "functions.processGame", maxConcurrency: undefined },
    { name: `${COMPONENT}_processPlayed`, handler: "functions.processPlayed", maxConcurrency: 1 },
];

