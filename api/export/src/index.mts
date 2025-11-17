import {
    Collection, CollectionWithMonthlyPlays, CollectionWithPlays,
    FAQCount, GeekGameQuery,
    GeekSummary, MultiGeekPlays,
    NewsItem, PlaysQuery,
    RankingTableRow,
    SystemStats,
    ToProcessElement,
    WarTableRow
} from "extstats-core";

export class ExtstatsApi {
    constructor(private baseUrl: string = "https://extstats.drfriendless.com/api") {
    }

    async getWarTable(): Promise<WarTableRow[]> {
        return (await (await fetch(`${this.baseUrl}/warTable`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as WarTableRow[];
    }

    async getUpdates(geek: string): Promise<ToProcessElement[]> {
        return (await (await fetch(`${this.baseUrl}/updates?geek=${geek}`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as ToProcessElement[];
    }

    async getGeekSummary(geek: string): Promise<GeekSummary> {
        return (await (await fetch(`${this.baseUrl}/geek?geek=${geek}`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as GeekSummary;
    }

    async getSystemStats(): Promise<SystemStats> {
        return (await (await fetch(`${this.baseUrl}/systemStats`, {
            headers: {
                "Accept": "application/json"
            }
        })).json()) as SystemStats;
    }

    async getUserList(): Promise<string[]> {
        return (await (await fetch(`${this.baseUrl}/userList`, {
            headers: {
                "Accept": "application/json"
            }
        })).json()) as string[];
    }

    async getNews(): Promise<NewsItem[]> {
        return (await (await fetch(`${this.baseUrl}/news`, {
            headers: {
                "Accept": "application/json"
            }
        })).json()) as NewsItem[];
    }

    async getRankings(): Promise<RankingTableRow[]> {
        return (await (await fetch(`${this.baseUrl}/rankings`, {
            headers: {
                "Accept": "application/json"
            }
        })).json()) as RankingTableRow[];
    }

    async markForUpdate(url: string): Promise<ToProcessElement> {
        return (await (await fetch(`${this.baseUrl}/markForUpdate`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "body": JSON.stringify({ url }),
            },
            method: "POST"
        })).json()) as ToProcessElement;
    }

    async incFAQCount(inc: number[]): Promise<FAQCount[]> {
        return (await (await fetch(`${this.baseUrl}/incFAQCount`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "body": JSON.stringify(inc),
            },
            method: "POST"
        })).json()) as FAQCount[];
    }

    async query(query: GeekGameQuery): Promise<Collection | CollectionWithPlays | CollectionWithMonthlyPlays> {
        return (await (await fetch(`${this.baseUrl}/query`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "body": JSON.stringify(query),
            },
            method: "POST"
        })).json()) as Collection | CollectionWithPlays | CollectionWithMonthlyPlays;
    }

    async plays(query: PlaysQuery): Promise<MultiGeekPlays> {
        return (await (await fetch(`${this.baseUrl}/plays`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "body": JSON.stringify(query),
            },
            method: "POST"
        })).json()) as MultiGeekPlays;
    }

    async retrieve(query: string): Promise<object> {
        return (await (await fetch(`${this.baseUrl}/retrieve?query=${query}`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method: "POST"
        })).json()) as MultiGeekPlays;
    }

    async findGeeks(fragment: string): Promise<string[]> {
        return (await (await fetch(`${this.baseUrl}/findGeeks?fragment=${fragment}`)).json()) as string[];
    }
}