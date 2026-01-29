import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {
    CloudWatchClient,
    CloudWatchServiceException,
    GetMetricStatisticsCommand, GetMetricStatisticsCommandInput,
    Statistic
} from "@aws-sdk/client-cloudwatch";

export async function handler(ignored: any): Promise<Record<string, number> | HttpResponse> {
    const system = await findSystem([]);
    if (isHttpResponse(system)) return system;

    const client = new CloudWatchClient({});
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 600000);
    const maximum: { Period: number, StartTime: Date, EndTime: Date, Statistics: Statistic[] } = {
        Period: 600,
        StartTime: startTime,
        EndTime: endTime,
        Statistics: ["Maximum"]
    };
    const average: { Period: number, StartTime: Date, EndTime: Date, Statistics: Statistic[] } = {
        Period: 600,
        StartTime: startTime,
        EndTime: endTime,
        Statistics: ["Average"]
    };
    const inputs: Record<string, GetMetricStatisticsCommandInput> = {
        "dl_opt_age": {
            Dimensions: [{Name: "QueueName", Value: "downloaderOutputQueue"}],
            MetricName: "ApproximateAgeOfOldestMessage",
            Namespace: "AWS/SQS",
            ...maximum
        },
        "dl_opt_length": {
            Dimensions: [{Name: "QueueName", Value: "downloaderOutputQueue"}],
            MetricName: "ApproximateNumberOfMessagesVisible",
            Namespace: "AWS/SQS",
            ...maximum
        },
        "dl_plays_age": {
            Dimensions: [{Name: "QueueName", Value: "downloaderPlaysQueue"}],
            MetricName: "ApproximateAgeOfOldestMessage",
            Namespace: "AWS/SQS",
            ...maximum
        },
        "dl_plays_length": {
            Dimensions: [{Name: "QueueName", Value: "downloaderPlaysQueue"}],
            MetricName: "ApproximateNumberOfMessagesVisible",
            Namespace: "AWS/SQS",
            ...maximum
        },
        "dl_retry_length": {
            Dimensions: [{Name: "QueueName", Value: "downloaderRetryQueue"}],
            MetricName: "ApproximateNumberOfMessagesVisible",
            Namespace: "AWS/SQS",
            ...maximum
        },
        "db_cpu": {
            Dimensions: [{Name: "DBInstanceIdentifier", Value: "extended-mysql"}],
            MetricName: "CPUUtilization",
            Namespace: "AWS/RDS",
            ...maximum
        },
        "db_credit": {
            Dimensions: [{Name: "DBInstanceIdentifier", Value: "extended-mysql"}],
            MetricName: "CPUCreditBalance",
            Namespace: "AWS/RDS",
            ...average
        },
        "eb2_cpu": {
            Dimensions: [{Name: "InstanceId", Value: "i-08ee3fc543a784ba9"}],
            MetricName: "CPUUtilization",
            Namespace: "AWS/EC2",
            ...maximum
        }
    };
    const data: Record<string, number> = {};
    for (const input of Object.entries(inputs)) {
        try {
            const command2 = new GetMetricStatisticsCommand(input[1]);
            const response2 = await client.send(command2);
            if (response2.Datapoints.length === 0) {
                console.log(`No value for ${input[0]}`);
                data[input[0]] = 0;
            } else {
                data[input[0]] = Math.round(response2.Datapoints[0][input[1].Statistics[0]]);
            }
        } catch (caught) {
            console.log(caught);
            if (caught instanceof CloudWatchServiceException) {
                console.error(`Error from CloudWatch. ${caught.name}: ${caught.message}`);
            } else {
                throw caught;
            }
        }
    }
    console.log(data);
    return data;
}