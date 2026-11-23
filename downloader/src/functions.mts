import {between, copyRequestStats} from "./library.mjs";
import {
    dispatchMarkAsProcessed,
    dispatchMarkAsTryAgainTomorrow,
    dispatchMarkAsUnprocessed,
    dispatchProcessCleanUpCollection,
    dispatchUpdateMetadata,
    dispatchUpdateTop50,
    dispatchUpdateUserList
} from "./dispatch.mjs";
import {
    CleanUpCollectionResult,
    FileToProcess,
    MetadataRuleResult, ProcessCollectionResult, SeriesMetadataResult, UpdateMetadataMessage, UpdateTop50Message, UpdateUserListMessage
} from "./interfaces.mjs";
import {isHttpResponse, loadSystem, System} from "./system.mjs";
import * as _ from 'lodash-es';

const MAX_GAMES_PER_CALL = 1000;
const METADATA_RULE_BASEGAME = 1;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export async function processUserList(_: UpdateUserListMessage) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    console.log(system.usersFile);
    const resp = await fetch(system.usersFile);
    console.log(resp);
    if (resp.ok) {
        const data = await resp.text();
        console.log(data);
        const lines = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);
        console.log(lines);
        await dispatchUpdateUserList(system, lines);
    } else {
        console.log("Unable to read users file");
        console.log(await resp.text());
    }
}

// Lambda to get the metadata from pastebin and send it to the database.
export async function processMetadata(_: UpdateMetadataMessage) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    const resp = await fetch(system.metadataFile);
    const data = await resp.text();
    const lines: string[] = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);

    const series: SeriesMetadataResult[] = [];
    const rules: MetadataRuleResult[] = [];
    for (const line of lines) {
        if (line.length === 0) continue;
        if (line.startsWith('#')) continue;
        let handled = false;
        if (line.indexOf(':') > 0) {
            const fields = line.split(/:/).map(s => s.trim());
            const title = fields[0];
            const gameIds = fields[1].split(/\s+/).map(x => parseInt(x)).filter(Number.isInteger);
            if (title.length > 0 && gameIds.length > 0) {
                handled = true;
                series.push({ name: title, games: gameIds });
            }
        } else {
            const fields = line.split(/\s+/).map(s => s.trim());
            if (fields.length === 2) {
                const gameId = parseInt(fields[1]);
                if (fields[0] === "basegame" && Number.isInteger(gameId)) {
                    handled = true;
                    rules.push({ rule: METADATA_RULE_BASEGAME, game: gameId });
                }
            }
        }
        if (!handled) console.log(`Did not understand metadata: ${line}`);
    }
    await dispatchUpdateMetadata(system, { series, rules });
}

export async function processBGGTop50(ignored: UpdateTop50Message) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    const TOP50_URL = "https://boardgamegeek.com/data_dumps/bg_ranks";
    const resp = await fetchFromBGG(system.gamesToken, TOP50_URL);
    // const resp = await fetch(TOP50_URL);
    const data = await resp.text();
    console.log(data);
    const lines: string[] = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);
    // console.log(JSON.stringify(lines));
    const top100 = _.dropWhile(lines, s => s.indexOf("<th class='collection_table'>") < 0)
        .filter(s => s.indexOf('href="/boardgame/') >= 0)
        .map(s => { console.log(s); return s; })
        .map(s => between(s, 'href="/boardgame/', '/'))
        .map(s => parseInt(s));
    console.log(JSON.stringify(top100));
    const top50 = _.take(top100, 50);
    await dispatchUpdateTop50(system, top50);
}

async function fetchFromBGG(token: string, url: string): Promise<Response> {
    return fetch(url, {
        headers: {
            "Accept": "application/xml",
            "Authorization": `Bearer ${token}`,
        }
    });
}

export async function cleanupCollection(system: System, collection: ProcessCollectionResult, url: string) {
    const params: CleanUpCollectionResult = {
        geek: collection.geek,
        items: collection.items.map(item => item.gameId),
        url: url
    };
    await dispatchProcessCleanUpCollection(system, params);
}

async function markAsProcessed(system: System, fileDetails: FileToProcess): Promise<void> {
    await dispatchMarkAsProcessed(system, fileDetails);
}

async function markAsUnprocessed(system: System, fileDetails: FileToProcess) {
    await dispatchMarkAsUnprocessed(system, fileDetails);
}

async function markTryAgainTomorrow(system: System, fileDetails: FileToProcess) {
    await dispatchMarkAsTryAgainTomorrow(system, fileDetails);
}

export function splitCollection(original: ProcessCollectionResult): ProcessCollectionResult[] {
    const stats = copyRequestStats(original);
    return _.chunk(original.items, MAX_GAMES_PER_CALL)
        .map(items => { return { geek: original.geek, items: items, ...stats }; });
}
