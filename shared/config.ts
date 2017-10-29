// code to deal with the configuration secrets which are stored on S3

import * as https from "https";
import {IncomingMessage} from "http";

const CONFIG_FILE = "https://s3-ap-southeast-2.amazonaws.com/extended-stats-aws/config.txt";

export type Configuration = { [key: string]: string };
export type ConfigurationConsumer = (o: Configuration) => void;
export type ConfigurationProducer = (consumer: ConfigurationConsumer) => void;

export const getConfig: ConfigurationProducer = (callback: ConfigurationConsumer) => {
    const data: Buffer[] = [];

    https.get(CONFIG_FILE, (response: IncomingMessage) => {
        response.on('error', (err: Error) => { console.log(err); return {} });
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => {
            const body = Buffer.concat(data).toString();
            console.log("config");
            console.log(body);
            const lines = body.split(/\r?\n/);
            const result: { [key: string]: string } = {};
            lines.forEach((line: string) => {
                if (line.indexOf('=') > 0) {
                    const fields = line.split("=");
                    const key = fields[0].trim();
                    const value = fields[1].trim();
                    result[key] = value;
                }
            });
            callback(result);
        });
    });
};

