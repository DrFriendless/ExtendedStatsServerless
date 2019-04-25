export interface SubMenu {
    name: string;
    style: string;
    items: MenuItem[];
}

export interface MenuItem {
    link: string;
    name: string;
}