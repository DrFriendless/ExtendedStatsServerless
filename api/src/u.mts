// master Lambda for user auth functions, to avoid startup times.

import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {changePassword, login, logout, personal, signup, updatePersonal} from "./auth.mjs";

export async function handler(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<any> {
    console.log(JSON.stringify(event));
    switch (event.requestContext.http.method) {
        case "POST": {
            switch (event.pathParameters["proxy"]) {
                case "login": return await login(event);
                case "logout": return await logout(event);
                case "signup": return await signup(event);
                case "changePassword": return await changePassword(event);
                case "updatePersonal": return await updatePersonal(event);
                default: return { statusCode: 404 }
            }
        }
        case "GET": {
            switch (event.pathParameters["proxy"]) {
                case "personal": return await personal(event);
                default: return { statusCode: 404 }
            }
        }
    }
}
