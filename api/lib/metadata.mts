// data shared by both the CDK script and the post-stack SDK script.

export const DEPLOYMENT_BUCKET = "extstats-deployment";
export const COMPONENT = "api";
export const REGION = "ap-southeast-2";
export const PROFILE = "drfriendless";

export interface LambdaSpec {
    name: string;
    handler: string;
    route: string;
    method: string;
}

export interface LambdaOnlySpec {
    name: string;
    handler: string;
}

export interface ExpressSpec {
    key: string;
    route: string;
    method: string;
}

export const LAMBDA_SPECS: LambdaSpec[] = [
    { name: `${COMPONENT}_wartable`, handler: "functions.getWarTable", route: "warTable", method: "GET" },
    { name: `${COMPONENT}_updates`, handler: "functions.getUpdates", route: "updates", method: "GET" },
    { name: `${COMPONENT}_geek`, handler: "functions.getGeekSummary", route: "geek", method: "GET" },
    { name: `${COMPONENT}_systemStats`, handler: "functions.adminGatherSystemStats", route: "systemStats", method: "GET" },
    { name: `${COMPONENT}_userList`, handler: "functions.getUserList", route: "userList", method: "GET" },
    { name: `${COMPONENT}_news`, handler: "functions.getNews", route: "news", method: "GET" },
    { name: `${COMPONENT}_rankings`, handler: "functions.getRankings", route: "rankings", method: "GET" },
    { name: `${COMPONENT}_markForUpdate`, handler: "functions.markForUpdate", route: "markForUpdate", method: "POST" },
    { name: `${COMPONENT}_updateOld`, handler: "functions.updateOld", route: "updateOld", method: "POST" },
    { name: `${COMPONENT}_incFAQCount`, handler: "functions.incFAQCount", route: "incFAQCount", method: "POST" },
    { name: `${COMPONENT}_query`, handler: "functions.query", route: "query", method: "POST" },
    { name: `${COMPONENT}_plays`, handler: "functions.plays", route: "plays", method: "POST" },
    { name: `${COMPONENT}_retrieve`, handler: "retrieve.retrieve", route: "retrieve", method: "GET" },
    { name: `${COMPONENT}_login`, handler: "auth.login", route: "login", method: "POST" },
    { name: `${COMPONENT}_logout`, handler: "auth.logout", route: "logout", method: "POST" },
    { name: `${COMPONENT}_signup`, handler: "auth.signup", route: "signup", method: "POST" },
    { name: `${COMPONENT}_changePassword`, handler: "auth.changePassword", route: "changePassword", method: "POST" },
    { name: `${COMPONENT}_update`, handler: "functions.markForUpdate", route: "update", method: "POST" },
    { name: `${COMPONENT}_checklist`, handler: "functions.getUserCheckList", route: "checklist", method: "GET" },
    { name: `${COMPONENT}_disambiguation`, handler: "functions.getDisambiguationData", route: "disambiguation", method: "GET" },
    { name: `${COMPONENT}_personal`, handler: "auth.personal", route: "personal", method: "GET" },
    { name: `${COMPONENT}_updatePersonal`, handler: "auth.updatePersonal", route: "updatePersonal", method: "POST" },
    { name: `${COMPONENT}_retrieveComments`, handler: "blog.retrieveCommentsForUrl", route: "retrieveComments", method: "GET" },
    { name: `${COMPONENT}_saveComment`, handler: "blog.saveComment", route: "saveComment", method: "POST" },
    { name: `${COMPONENT}_updateComment`, handler: "blog.updateComment", route: "updateComment", method: "POST" },
    { name: `${COMPONENT}_deleteComment`, handler: "blog.deleteComment", route: "deleteComment", method: "POST" },
];

export const LAMBDA_ONLY_SPECS: LambdaOnlySpec[] = [
    { name: `auth_confirm`, handler: "auth.confirm" }
];

export const OTHER_LAMBDA_NAMES: string[] = [
    "socks_connect", "socks_disconnect", "socks_default"
];

export const EXPRESS_SPECS: ExpressSpec[] = [
    { key: "findgeeks", route: "findgeeks",  method: "GET" },
    { key: "count", route: "count",  method: "POST" },
];
