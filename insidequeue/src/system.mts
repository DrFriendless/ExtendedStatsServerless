import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

export async function loadSystem() {
    const s = new System();
    return await s.loadSecrets();
}

export class System {
    downloaderQueue: string;
    systemLogGroup: string;
    ok: boolean;

    constructor() {
        this.ok = false;
    }

    async loadSecrets(): Promise<System> {
        this.systemLogGroup = await this.getParameter("/extstats/systemLogGroup");
        this.downloaderQueue = await this.getParameter("/extstats/downloader/queue");
        this.ok = true;
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
