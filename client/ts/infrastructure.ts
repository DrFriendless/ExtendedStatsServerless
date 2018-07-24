interface ExtStatsStorage {
    geek: string;
}

// https://css-tricks.com/snippets/javascript/get-url-variables/
function getQueryVariable(variable: string): string | undefined {
    const query = window.location.search.substring(1);
    const vars = query.split("&");
    for (let i=0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
    return undefined;
}

function getExtStatsStorage(): ExtStatsStorage {
    const localStorage = window.localStorage;
    localStorage.extStats = localStorage.extStats || {};
    return localStorage.extStats as ExtStatsStorage;
}

const geek = getQueryVariable("geek");
if (geek) getExtStatsStorage().geek = geek;