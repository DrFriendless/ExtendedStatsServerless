import {UserConfig} from "extstats-core";
import {SecureUserData} from "./auth.mjs";

export interface VarBinding {
    name: string;
    value: string;
}

export class VarBindings {
    private readonly vars: Record<string, string> = {};
    private readonly userData: SecureUserData | undefined;

    constructor(varBindings: VarBinding[], userData: SecureUserData | undefined) {
        for (const vb of varBindings) this.vars[vb.name] = vb.value;
        this.userData = userData;
    }

    lookup(name: string): string | undefined {
        return this.vars[name];
    }

    hasUserData(): boolean {
        return !!this.userData;
    }

    getUserConfig(): UserConfig | undefined {
        if (this.userData) return new UserConfig(this.userData.data);
        return undefined;
    }
}

