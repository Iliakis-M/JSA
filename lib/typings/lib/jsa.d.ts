/// <reference types="node" />
import { EventEmitter } from "events";
export declare module JSA {
    namespace config {
        var extname: string;
        var jmplab: string;
        var arraysep: string;
        var startsmbl: string;
        var endsmbl: string;
        var base: string;
        var asn: string;
        var aw: string;
        var fn: string;
        var isScopeEnd: string;
        var sep: string;
        var endl: string;
        var sep_r: RegExp;
        var endl_r: RegExp;
        var isScope: RegExp;
        var comment: RegExp;
        var index: RegExp;
        var str: RegExp;
        var prop: RegExp;
        var escs: RegExp;
    }
    namespace JSAErrors {
        const EBADN: SyntaxError;
        const EBADS: SyntaxError;
        const EBADCAL: SyntaxError;
        const EBADSYN: SyntaxError;
        const EINSNOTEX: SyntaxError;
        const EBADJMP: SyntaxError;
        const EBADPTH: ReferenceError;
    }
    class Scope extends EventEmitter {
        readonly scopes: Map<string, Scope>;
        readonly registers: Map<string, any>;
        readonly instructions: Instruction[];
        readonly name: string;
        readonly _streams: {
            input: NodeJS.ReadStream;
            output: NodeJS.WriteStream;
            error: NodeJS.WriteStream;
        };
        constructor(name?: string);
        call(): Promise<void>;
        protected add(inst: Instruction | string): Instruction | string;
        getReg(reg: string): any;
        setReg(reg: string, value: any): Map<string, any>;
        makeObj(): Scope;
        static load(code: string, name?: string): Scope;
    }
    class Instruction {
        protected readonly parent: Scope;
        protected readonly _params: string[];
        static mappings: Map<RegExp, typeof Instruction>;
        protected constructor(inst: string, parent: Scope);
        static parse(line: string, parent: Scope): Instruction;
        call(): Promise<boolean>;
    }
    namespace Instructions {
        class Add extends Instruction {
            protected readonly to: string;
            protected readonly num: number | string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Sub extends Add {
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Mul extends Add {
            protected readonly num: number | string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Div extends Mul {
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Mod extends Div {
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Mov extends Instruction {
            protected readonly from: number | string | Array<any>;
            protected readonly to: string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Slp extends Instruction {
            protected readonly interval: number | string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Label extends Instruction {
            readonly name: string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Jmp extends Instruction {
            protected to: string | number;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class If extends Instruction {
            private readonly eq;
            protected readonly from: string;
            protected readonly to: string | number;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Prt extends Instruction {
            protected readonly default: string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Inp extends Instruction {
            protected readonly to: string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Method extends Instruction {
            protected readonly name: string;
            protected readonly to: string;
            protected readonly args: string;
            protected readonly isAw: boolean;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
        class Inc extends Instruction {
            protected from: string;
            protected readonly to: string;
            constructor(inst: string, parent: Scope);
            call(): Promise<boolean>;
        }
    }
    function load(file: string): Promise<Scope>;
}
export default JSA;
//# sourceMappingURL=jsa.d.ts.map