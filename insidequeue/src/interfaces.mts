export interface NormalisedPlays {
    year: number;
    month: number;
    date: number;
    geek: number;
    game: number;
    quantity: number;
    expansionPlay: boolean;
    location: string;
}

// this is what the message broker is expecting
export interface WebsockMessage {
    users: string[];
    topics: string[];
    body: any;
}