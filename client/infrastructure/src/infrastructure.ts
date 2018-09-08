// https://css-tricks.com/snippets/javascript/get-url-variables/
import {withExtStatsStorage} from "./extstats-storage";

function getQueryVariable(variable: string): string | undefined {
    const query = window.location.search.substring(1);
    const vars = query.split("&");
    for (let i=0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        console.log(pair);
        if (pair[0] == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return undefined;
}

const geek = getQueryVariable("geek");
if (geek) {
    console.log("geek = " + geek);
    withExtStatsStorage(storage => storage.geek = geek);
}


