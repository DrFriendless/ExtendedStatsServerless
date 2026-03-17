import {SelectorMetadata} from "export";

export class SelectorMetadataSet {
    metadata: { [bggid: string]: SelectorMetadata } = {};

    public lookup(id: number): SelectorMetadata | undefined {
        return this.metadata[id.toString()];
    }

    public restrictTo(ids: number[]) {
        const newMetadata = {} as { [bggid: string]: SelectorMetadata };
        ids.forEach(id => {
            const sid = id.toString();
            if (this.metadata[sid]) {
                newMetadata[sid] = this.metadata[sid];
            }
        });
        this.metadata = newMetadata;
    }

    public add(game: number, key: string, value: string) {
        const sid = game.toString();
        if (!this.metadata[sid]) this.metadata[sid] = { game };
        (this.metadata[sid] as any)[key] = value;
    }

    public addIfNotPresent(game: number, key: string, value: string) {
        const sid = game.toString();
        if (this.metadata[sid] && !(this.metadata[sid] as any)[key]) (this.metadata[sid] as any)[key] = value;
    }
}