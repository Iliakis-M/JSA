/// <reference types="node" />
import { EventEmitter } from "events";
export declare module JSA {
    namespace config {
        var extname: string;
        var endl: string;
        var sep: string;
        var modifiers: RegExp;
        var isScope: RegExp;
        var isScopeEnd: RegExp;
    }
    namespace JSAErrors {
        const EBADN: SyntaxError;
        const EBADS: SyntaxError;
    }
    class Scope extends EventEmitter {
        scopes: Map<string, Scope>;
        registers: Map<string, number>;
        instructions: Instruction[];
        isNS: boolean;
        isAsync: boolean;
        name: string;
        constructor(name?: string, isNS?: boolean);
        call(...params: any[]): void;
        add(inst: Instruction | string): string | Instruction;
        static load(code: string, name?: string, isNS?: boolean): Scope;
    }
    class Instruction {
        params: string[];
        parent: Scope;
        static mappings: Map<RegExp, typeof Instruction>;
        constructor(inst: string, parent: Scope);
        static parse(line: string, parent: Scope): Instruction;
    }
    namespace Instructions {
        class Add extends Instruction {
            constructor(inst: string, parent: Scope);
        }
    }
    function load(file: string): Promise<Scope>;
}
export default JSA;
//# sourceMappingURL=jsa.d.ts.map