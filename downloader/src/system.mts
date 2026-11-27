import {GetParameterCommand, GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";
import {SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {S3Client, GetObjectCommand, PutObjectCommand, PutObjectCommandOutput} from "@aws-sdk/client-s3";
import {PublishCommand, SNSClient} from "@aws-sdk/client-sns";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

const BGG_SECRETS = "extstats/bgg";

export async function loadSystem() {
    const s = new System();
    const a = await s.loadSecrets();
    if (isHttpResponse(a)) return a;
    s.loadQueues();
    return await s.loadBGGSecrets();
}

// this is what the message broker is expecting
interface WebsockMessage {
    users: string[];
    topics: string[];
    body: any;
}

export class System {
    logBucket: string;
    cacheBucket: string;
    snsTopic: string;
    metadataFile: string;
    outputQueue: string | undefined;
    inputQueue: string | undefined;
    retryQueue: string | undefined;
    messageQueue: string | undefined;

    usersFile: string;
    systemLogGroup: string;
    usersToken: string;
    gamesToken: string;
    extrasToken: string;
    playsToken: string;
    collectionToken: string;

    async getObjectFromS3(bucket: string, objectKey: string): Promise<string | HttpResponse> {
        const s3Client = new S3Client({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const resp = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
        if (resp.$metadata.httpStatusCode === 200) {
            return await resp.Body.transformToString();
        } else {
            console.log(`Error: ${JSON.stringify(resp.$metadata)}`);
        }
    }

    async putObjectToS3(bucket: string, objectKey: string, content: string): Promise<PutObjectCommandOutput> {
        const s3Client = new S3Client({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const resp = await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey }));
        if (resp.$metadata.httpStatusCode !== 200) {
            console.log(`Error putting object to S3: ${JSON.stringify(resp.$metadata)}`);
        }
        return resp;
    }

    loadQueues() {
        this.retryQueue = process.env.RETRY_QUEUE;
        this.messageQueue = process.env.MESSAGE_QUEUE;
        this.inputQueue = process.env.INPUT_QUEUE;
        this.outputQueue = process.env.OUTPUT_QUEUE;
    }

    async loadSecrets(): Promise<System | HttpResponse> {
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const path = "/extstats/downloader";
        try {
            const response = await ssmClient.send(
                new GetParametersByPathCommand({
                    Path: path,
                    Recursive: true
                })
            );
            for (const p of response.Parameters) {
                switch (p.Name) {
                    case `${path}/logBucket`:
                        this.logBucket = p.Value;
                        break;
                    case `${path}/metadataFile`:
                        this.metadataFile = p.Value;
                        break;
                    case `${path}/usersFile`:
                        this.usersFile = p.Value;
                        break;
                    case `${path}/cache`:
                        this.cacheBucket = p.Value;
                        break;
                    case `${path}/topic`:
                        this.snsTopic = p.Value;
                        break;
                }
            }
            this.systemLogGroup = await this.getParameter("/extstats/systemLogGroup");
        } catch (error) {
            console.log(error);
            return {
                "statusCode": 500,
                "body": JSON.stringify({error: `Can't retrieve downloader parameters - make sure it exists in AWS.`})
            }
        }
        return this;
    }

    async loadBGGSecrets(): Promise<HttpResponse | System> {
        const client = new SecretsManagerClient({
            region: process.env.AWS_REGION
        });
        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: BGG_SECRETS
                })
            );
            const secret = response.SecretString;
            const obj = JSON.parse(secret);
            this.usersToken = obj.users_token;
            this.extrasToken = obj.extras_token;
            this.playsToken = obj.plays_token;
            this.collectionToken = obj.collection_token;
            this.gamesToken = obj.games_token;
        } catch (error) {
            console.log(error);
            return {
                "statusCode": 500,
                "body": JSON.stringify({error: `Can't find secret ${BGG_SECRETS} - make sure it exists in AWS.`})
            }
        }
        return this;
    }

    async getParameter(key: string): Promise<string> {
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const response = await ssmClient.send(
            new GetParameterCommand({
                Name: key
            })
        );
        return response.Parameter.Value;
    }

    async publishError(message: string, component: string): Promise<void> {
        const snsClient = new SNSClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const response = await snsClient.send(
            new PublishCommand({
                Message: message,
                Subject: `Alert from Extstats Downloader ${component}`,
                TopicArn: this.snsTopic
            })
        );
        console.log(JSON.stringify(response));
    }

    async sendMessage(geeks: string[], topics: string[], body: any): Promise<void> {
        const sqs = new SQSClient({ region: process.env.REGION });
        const payload: WebsockMessage = { body, topics, users: geeks };
        const command = new SendMessageCommand({
            QueueUrl: this.messageQueue,
            MessageBody: JSON.stringify(payload)
        });
        try {
            const resp = await sqs.send(command);
        } catch (error) {
            console.log(error);
        }
    }
}

export interface HttpResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, any>;
}

export function isHttpResponse(object: any): object is HttpResponse {
    if (typeof object === "string") return false;
    return object && 'statusCode' in object;
}