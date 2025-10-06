import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";
import S3StreamLogger from "s3-streamlogger";

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
    ok: boolean;
    logstream: S3StreamLogger.S3StreamLogger;

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
            this.logstream = new S3StreamLogger.S3StreamLogger({ bucket: this.logBucket });
            this.ok = true;
        } catch (error) {
            console.log(error);
        }
        return this;
    }
}
