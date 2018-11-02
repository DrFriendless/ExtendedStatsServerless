import {ExpansionData} from "extstats-core";
import { suite, test, slow, timeout } from "mocha-typescript";
var assert = require('assert');

const CARC = 1;
const CARCEXP1 = 2;
const CARCEXP2 = 3;

const expansionData = new ExpansionData([
    { basegame: CARC, expansion: CARCEXP1 },
    { basegame: CARC, expansion: CARCEXP2 },

]);

suite("one", () => {
    test("test", () => {});
});

// mocha-typescript won't work because of bluebird bullshit
// mocha won't work because of typescript
// what a fucking retarded ecosystem
