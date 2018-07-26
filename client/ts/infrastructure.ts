interface ExtStatsStorage {
    geek: string;
}

// https://css-tricks.com/snippets/javascript/get-url-variables/
function getQueryVariable(variable: string): string | undefined {
    const query = window.location.search.substring(1);
    const vars = query.split("&");
    for (let i=0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        console.log(pair);
        if (pair[0] == variable) {
            return pair[1];
        }
    }
    return undefined;
}

function getExtStatsStorage(): ExtStatsStorage {
    const localStorage = window.localStorage;
    console.log(typeof localStorage.extStats);
    let result = {};
    if (localStorage.extStats) {
        try {
            result = JSON.parse(localStorage.extStats);
        } catch (err) {
            console.log(err);
        }
    }
    return result as ExtStatsStorage;
}

function withExtStatsStorage(func: (storage: ExtStatsStorage) => void) {
    const content = getExtStatsStorage();
    func(content);
    window.localStorage.extStats = JSON.stringify(content);
}

const geek = getQueryVariable("geek");
console.log("geek = " + geek);
if (geek) withExtStatsStorage(storage => storage.geek = geek);
