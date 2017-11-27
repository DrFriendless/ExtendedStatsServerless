// code to deal with the configuration secrets which are stored on S3

import {S3} from 'aws-sdk';

export type Configuration = { [key: string]: string };
export type ConfigurationConsumer = (o: Configuration) => void;
export type ConfigurationProducer = (consumer: ConfigurationConsumer) => void;

export const getConfig: ConfigurationProducer = (callback: ConfigurationConsumer) => {
    const s3 = new S3({ apiVersion: '2006-03-01' });
    const params = {
        Bucket: "extended-stats-aws",
        Key: "config.txt"
    };
    s3.getObject(params, (err, data) => {
        if (err) {
            console.log(err);
            console.log("Unable to read config file.");
            callback({});
        } else {
            const s = data.Body.toString();
            const re = /[\r\n]+/;
            const lines = s.split(re);
            const result = {};
            lines.forEach(line => {
                const fields = line.trim().split("=");
                if (fields.length === 2) {
                    result[fields[0].trim()] = fields[1].trim();
                }
            });
            console.log(result);
            callback(result);
        }
    });
};

