import {
    Collection, CollectionWithMonthlyPlays, CollectionWithPlays, DisambiguationData,
    FAQCount, GeekGameQuery,
    GeekSummary, MultiGeekPlays,
    NewsItem, PlaysQuery,
    RankingTableRow,
    SystemStats,
    ToProcessElement,
    WarTableRow
} from "extstats-core";
import {BlogComment} from "extstats-core/blog-interfaces.js";

export type AuthResultType = "code" | "userdata" | "failure";

export interface AuthResultCode {
    type: "code";
    code: string;
}
export interface AuthResultLoginSuccess {
    type: "userdata";
    data: any;
}
export interface AuthResultFailure {
    type: "failure";
    state: string;
}
export type AuthResult = AuthResultCode | AuthResultLoginSuccess | AuthResultFailure;

export class ExtstatsApi {
    constructor(private baseUrl: string) {
    }

    async getWarTable(): Promise<WarTableRow[]> {
        return (await (await fetch(`${this.baseUrl}/warTable`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as WarTableRow[];
    }

    async getUpdates(geek: string): Promise<{ forGeek: ToProcessElement[], forSystem: Record<string, number> }> {
        return (await (await fetch(`${this.baseUrl}/updates?geek=${geek}`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as { forGeek: ToProcessElement[], forSystem: Record<string, number> };
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
                "Accept": "application/json"
            },
            body: JSON.stringify({ url }),
            method: "POST"
        })).json()) as ToProcessElement;
    }

    async updateOld(geek: string): Promise<string[]> {
        return (await (await fetch(`${this.baseUrl}/updateOld?geek=${geek}`, {
            headers: {
                "Accept": "application/json",
            },
            method: "POST"
        })).json()) as string[];
    }

    async incFAQCount(inc: number[]): Promise<FAQCount[]> {
        return (await (await fetch(`${this.baseUrl}/incFAQCount`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(inc),
            method: "POST"
        })).json()) as FAQCount[];
    }

    async query(query: GeekGameQuery): Promise<Collection | CollectionWithPlays | CollectionWithMonthlyPlays> {
        return (await (await fetch(`${this.baseUrl}/query`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(query),
            method: "POST"
        })).json()) as Collection | CollectionWithPlays | CollectionWithMonthlyPlays;
    }

    async plays(query: PlaysQuery): Promise<MultiGeekPlays> {
        return (await (await fetch(`${this.baseUrl}/plays`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(query),
            method: "POST"
        })).json()) as MultiGeekPlays;
    }

    async retrieve(query: string): Promise<object> {
        return (await (await fetch(`${this.baseUrl}/retrieve?query=${query}`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method: "GET"
        })).json()) as MultiGeekPlays;
    }

    async findGeeks(fragment: string): Promise<string[]> {
        return (await (await fetch(`${this.baseUrl}/findgeeks?fragment=${fragment}`)).json()) as string[];
    }

    async signup(username: string, password: string): Promise<AuthResult> {
        const response = await fetch(`${this.baseUrl}/signup`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "body": JSON.stringify({ username, password }),
            method: "POST"
        });
        const body = await response.json() as object;
        if (response.status === 200 && "code" in body) {
            return {
                type: "code",
                code: body.code as string,
            }
        } else if ("state" in body) {
            return {
                type: "failure",
                state: body.state as string,
            }
        } else {
            return {
                type: "failure",
                state: "START",
            };
        }
    }

    async changedPassword(username: string, password: string): Promise<AuthResult> {
        const response = await fetch(`${this.baseUrl}/changePassword`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "body": JSON.stringify({ username, password }),
            method: "POST"
        });
        const body = await response.json() as object;
        if (response.status === 200 && "code" in body) {
            return {
                type: "code",
                code: body.code as string,
            }
        } else if ("state" in body) {
            return {
                type: "failure",
                state: body.state as string,
            }
        } else {
            return {
                type: "failure",
                state: "START",
            };
        }
    }

    async login(username: string, password: string): Promise<AuthResult> {
        const response = await fetch(`${this.baseUrl}/login`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "body": JSON.stringify({ username, password }),
            method: "POST"
        });
        const body = await response.json() as { state: string };
        if (response.status === 200) {
            return {
                type: "userdata",
                data: body
            }
        } else if ("state" in body) {
            return {
                type: "failure",
                state: body.state as string,
            }
        } else {
            return {
                type: "failure",
                state: "START",
            };
        }
    }

    async logout(): Promise<string> {
        return (await (await fetch(`${this.baseUrl}/logout`, {
            headers: {
                "Accept": "application/json",
            },
            method: "POST"
        })).json()) as string;
    }

    async getPersonalData(): Promise<any> {
        return (await (await fetch(`${this.baseUrl}/personal`, {
            headers: {
                "Accept": "application/json",
            }
        })).json()) as string;
    }

    async updatePersonalData(data: any): Promise<void> {
        await fetch(`${this.baseUrl}/updatePersonal`, {
            headers: {
                "Content-Type": "application/json",
            },
            "body": JSON.stringify(data),
            method: "POST"
        });
    }

    async retrieveCommentsForUrl(url: string): Promise<BlogComment[]> {
        return (await (await fetch(`${this.baseUrl}/retrieveComments?url=${url}`, {
            headers: {
                "Accept": "application/json"
            }
        })).json()) as BlogComment[];
    }

    async saveComment(url: string, comment: string, replyTo: number | undefined): Promise<{ id: number | undefined, posts: BlogComment[] }> {
        const body = { url, comment, replyTo };
        return (await (await fetch(`${this.baseUrl}/saveComment`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            "body": JSON.stringify(body),
            method: "POST"
        })).json()) as { id: number | undefined, posts: BlogComment[] };
    }

    async updateComment(id: number, comment: string): Promise<{ id: number, posts: BlogComment[] }> {
        const body = { id, comment };
        return (await (await fetch(`${this.baseUrl}/updateComment`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            "body": JSON.stringify(body),
            method: "POST"
        })).json()) as { id: number, posts: BlogComment[] };
    }

    async deleteComment(id: number): Promise<{ posts: BlogComment[] }> {
        const body = { id };
        return (await (await fetch(`${this.baseUrl}/deleteComment`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            "body": JSON.stringify(body),
            method: "POST"
        })).json()) as { posts: BlogComment[] };
    }

    async getDisambiguationData(geek: string): Promise<DisambiguationData> {
        return (await (await fetch(`${this.baseUrl}/disambiguation?geek=${geek}`, {
            headers: {
                "Content-Type": "application/json"
            }
        })).json()) as DisambiguationData;
    }
}