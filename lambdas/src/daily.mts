import {SendMessageCommand, SendMessageCommandOutput, SQSClient} from "@aws-sdk/client-sqs";
import {findSystem, isHttpResponse} from "./system.mjs";

export async function dailyTasks(event: any) {
    const system = await findSystem(["message"]);
    if (isHttpResponse(system)) return system;

    const body = { discriminator: "RebuildMaterialisedViews" };
    const command = new SendMessageCommand({
        QueueUrl: system.downloaderQueue,
        MessageBody: JSON.stringify(body),
    });
    const sqsClient = new SQSClient({ });
    const dispatchResult: SendMessageCommandOutput = await sqsClient.send(command);
    if (dispatchResult.$metadata.httpStatusCode !== 200) {
        console.log(JSON.stringify(dispatchResult));
    }
}