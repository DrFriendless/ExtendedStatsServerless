// probably something like an LL(1) recursive descent parser
// I couldn't get nearleyc to produce code that didn't crash node so I wrote this rather than muck with it.

import * as moo from 'moo';

const tokens = {
    whitespace: /[ \t]+/,
    identifier: /[a-z][a-zA-Z0-9]*/,
    int:        /0|[1-9][0-9]*/,
    str:        /"(?:\\["\\]|[^\n"\\])*"/,
    lparen:     '(',
    rparen:     ')',
    comma:      ',',
    keyword:    /[A-Z][A-Z0-9]*/,
};

export enum Argument {
    Keyword, Integer, StringValue, Expression
}

export interface Arg {
    kind: Argument;
}

export interface Keyword extends Arg {
    kind: Argument.Keyword;
    keyword: string;
}

export interface Integer extends Arg {
    kind: Argument.Integer;
    value: number;
}

export interface StringValue extends Arg {
    kind: Argument.StringValue;
    value: string;
}

export interface Expression extends Arg {
    kind: Argument.Expression;
    func: string;
    args: Arg[];
}

interface Token {
    type: string;
    value: string;
    offset: number;
    lineBreaks: number;
    line: number;
    col: number;
}

class ParseState {
    private pointer: number;

    constructor(private tokens: Token[]) {
        this.pointer = 0;
    }

    peek(): Token {
        return this.tokens[this.pointer];
    }

    next(): Token {
        return this.tokens[this.pointer++];
    }

    consume(type: string) {
        const t = this.next();
        if (t.type != type) throw new Error("Expected " + type + " got " + t.type);
    }

    pushback() {
        this.pointer--;
    }
}

export function parse(input: string): Expression {
    const lexer = moo.compile(tokens);
    lexer.reset(input);
    return parseExpression(new ParseState(Array.from(lexer).filter(tok => tok.type !== 'whitespace')));
}

function parseExpression(state: ParseState): Expression {
    const func = state.next().value;
    state.consume("lparen");
    const args = parseArgs(state);
    state.consume("rparen");
    return { kind: Argument.Expression, func, args } as Expression;
}

function parseArgs(state: ParseState): Arg[] {
    const result = [];
    while (true) {
        const peek = state.peek();
        if (peek.type === "rparen") return result;
        const arg = parseArg(state);
        result.push(arg);
        const after = state.peek();
        if (after.type != "comma") return result;
        state.consume("comma");
    }
}

function parseArg(state: ParseState): Arg {
    const next = state.next();
    if (next.type === "keyword") {
        return { kind: Argument.Keyword, keyword: next.value } as Keyword;
    } else if (next.type === "int") {
        return { kind: Argument.Integer, value: parseInt(next.value) } as Integer;
    } else if (next.type === "str") {
        return { kind: Argument.StringValue, value: next.value } as StringValue;
    } else {
        state.pushback();
        return parseExpression(state);
    }
}
