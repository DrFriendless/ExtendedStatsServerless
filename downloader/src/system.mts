import {GetParameterCommand, GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

const BGG_SECRETS = "extstats/bgg";

export async function loadSystem() {
    const s = new System();
    const a = await s.loadSecrets();
    if (isHttpResponse(a)) return a;
    return await s.loadBGGSecrets();
}

export class System {
    logBucket: string;
    cacheBucket: string;
    metadataFile: string;
    downloaderQueue: string;
    playsQueue: string;
    usersFile: string;
    systemLogGroup: string;
    usersToken: string;
    gamesToken: string;
    extrasToken: string;
    playsToken: string;
    collectionToken: string;

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
                    case `${path}/queue`:
                        this.downloaderQueue = p.Value;
                        break;
                    case `${path}/playsqueue`:
                        this.playsQueue = p.Value;
                        break;
                    case `${path}/cache`:
                        this.cacheBucket = p.Value;
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
}

export interface HttpResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, any>;
}

export function isHttpResponse(object: any): object is HttpResponse {
    return object && 'statusCode' in object;
}