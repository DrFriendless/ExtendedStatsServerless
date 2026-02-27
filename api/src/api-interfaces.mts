export interface GeeklistCheck {
    geek: string;
    geeklistId: number;
    items: GeeklistItemCheck[];
}

export interface GeeklistItemCheck {
    id: string;
    bggid: number;
    name: string;
    user: string;
    wtb: boolean;
    wtp: boolean;
    wit: boolean;
    rating: number;
    owned: boolean;
    prevOwned: boolean;
    wishlist: number;
}

