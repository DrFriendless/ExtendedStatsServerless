export interface ToProcessElement {
    filename: string,
    url: string,
    lastUpdate: any,
    processMethod: string,
    nextUpdate: any,
    geek: string,
    tillNextUpdate: any,
    description: string,
    lastattempt: any,
    last_scheduled: any;
}

export interface ToProcessList {
    statusCode: number;
    body: [ToProcessElement];
}

export interface ProcessUserInvocation {
    geek: string,
    url: string
}

export interface ProcessUserResult {
    geek: string;
    bggid: number;
    country: string;
    url: string;
}
