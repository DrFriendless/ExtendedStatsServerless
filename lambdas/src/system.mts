import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";

const BGG_SECRETS = "extstats/bgg";

export async function findSystem(): Promise<System> {
    const s = new System();
    await s.loadBGGSecrets();
    return s;
}

export class System {
    public forumChecker: string | undefined;
    public minarticleid: number;
    public authcheckThread: string | undefined;

    async loadBGGSecrets(): Promise<HttpResponse | void> {
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
            this.forumChecker = obj.forum_checker;
        } catch (error) {
            console.log(error);
            return {
                "statusCode": 500,
                "body": JSON.stringify({error: `Can't find secret ${BGG_SECRETS} - make sure it exists in AWS.`})
            }
        }
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const path = "/extstats/authcheck";
        const response = await ssmClient.send(
            new GetParametersByPathCommand({
                Path: path,
                Recursive: true
            })
        );
        for (const p of response.Parameters) {
            console.log(p.Name);
            switch (p.Name) {
                case `${path}/minarticleid`:
                    this.minarticleid = parseInt(p.Value);
                    break;
                case `${path}/url`:
                    this.authcheckThread = p.Value;
                    break;
            }
        }
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