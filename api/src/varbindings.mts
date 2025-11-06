export interface VarBinding {
    name: string;
    value: string;
}

export class VarBindings {
    private readonly vars: Record<string, string> = {};

    constructor(varBindings: VarBinding[]) {
        for (const vb of varBindings) this.vars[vb.name] = vb.value;
    }

    lookup(name: string): string | undefined {
        return this.vars[name];
    }
}

