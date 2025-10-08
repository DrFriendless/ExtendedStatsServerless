import {GetParameterCommand, GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";

export async function loadSystem() {
    const s = new System();
    return await s.loadSecrets();
}

export class System {
    paramKey: string;
    logBucket: string;
    metadataFile: string;
    downloaderQueue: string;
    usersFile: string;
    systemLogGroup: string;
    ok: boolean;

    constructor() {
        this.paramKey = `/extstats/downloader`;
        this.ok = false;
    }

    async loadSecrets(): Promise<System> {
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
                }
            }
            this.systemLogGroup = await this.getParameter("/extstats/systemLogGroup");
            this.ok = true;
        } catch (error) {
            console.log(error);
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
