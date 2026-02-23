export interface WebsockMessage {
    users: string[];
    topics: string[];
    body: any;
}

export interface QueueInput {
    Records: {
        receiptHandle: string;
        body: string;
        awsRegion: string;
    }[]
}