"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
const os_1 = require("os");
const events_1 = require("events");
const path_1 = require("path");
//IMPL: objects
var JSA;
(function (JSA) {
    let config;
    (function (config) {
        config.extname = ".jsa";
        config.jmplab = ':';
        config.arraysep = ',';
        config.startsmbl = "__START_";
        config.endsmbl = "__END_";
        config.base = "__BASE__";
        config.asn = "asn";
        config.aw = "aw";
        config.fn = "def";
        config.isScopeEnd = "end";
        config.sep = ' ';
        config.endl = os_1.EOL;
        config.sep_r = /(?<!\\) /gm;
        config.endl_r = /(?<!\\)\n/gm;
        //SECOND EXPANSION
        config.isScope = new RegExp("^(" + config.asn + " )?(" + config.fn + ") ?", '');
        config.comment = /#.*$/is;
        config.index = /\[(.+)\]|\((.+)\)/ms;
        config.str = /^['"](.+)['"]$/ms;
        config.prop = /\.(.+)$/ms;
        config.escs = /(?<!\\)\\/gm;
    })(config = JSA.config || (JSA.config = {})); //config
    let JSAErrors;
    (function (JSAErrors) {
        JSAErrors.EBADN = new SyntaxError("Bad Name.");
        JSAErrors.EBADS = new SyntaxError("Bad Scope.");
        JSAErrors.EBADCAL = new SyntaxError("Bad parameters.");
        JSAErrors.EBADSYN = new SyntaxError("Bad Syntax.");
        JSAErrors.EINSNOTEX = new SyntaxError("Instruction does not exist.");
        JSAErrors.EBADJMP = new SyntaxError("Bad Jump.");
    })(JSAErrors = JSA.JSAErrors || (JSA.JSAErrors = {})); //JSAErrors
    class Scope extends events_1.EventEmitter {
        constructor(name, isAsync) {
            super();
            this.scopes = new Map();
            this.registers = new Map([
                ["acc", 0],
                ["jmx", 0],
                ["jmb", 0],
                ["ENDL", os_1.EOL],
                ["ARGS", []],
                ["_math", Math],
                ["_date", Date],
                ["null", null]
            ]);
            this.instructions = [];
            this.isAsync = false;
            this.name = config.base;
            this._streams = {
                input: process.stdin,
                output: process.stdout,
                error: process.stderr
            };
            this.name = name || this.name;
            this.isAsync = isAsync || this.isAsync;
            this._streams.input.setRawMode(true);
            this._streams.input.resume();
        } //ctor
        async call() {
            for (; this.registers.get("jmx") < this.instructions.length; this.registers.set("jmx", this.registers.get("jmx") + 1)) {
                if (await this.instructions[this.registers.get("jmx")].call())
                    break;
            }
            if (this.name === config.base)
                process.exit();
        } //call
        add(inst) {
            if (typeof inst === "string") {
                if (inst === '')
                    return inst;
                inst = Instruction.parse(inst, this);
            }
            this.instructions.push(inst);
            return inst;
        } //add
        getReg(reg) {
            if (config.index.test(reg)) {
                if (reg.replace(config.index, '')) {
                    let mat = reg.match(config.index);
                    reg = reg.replace(config.index, '');
                    let t = mat[0].replace(config.index, "$1");
                    //@ts-ignore
                    if (isNaN(t * 1) === false)
                        t *= 1;
                    if (typeof t === "number") {
                        let tmp = this.getReg(reg);
                        return typeof tmp[t] === "function" ? tmp[t].bing(tmp) : tmp[t];
                    }
                    else if (config.str.test(t)) { //D?
                        t = t.replace(config.str, "$1"); //why not use .prop syntax instead?
                        let ret = this.getReg(reg), tmp = (ret instanceof Scope) ? ret.getReg(t) : ret[t];
                        return typeof tmp === "function" ? tmp.bind(ret) : tmp;
                    }
                    else {
                        let tmp = this.getReg(reg), got = tmp[this.getReg(t)];
                        return typeof got === "function" ? got.bind(tmp) : got;
                    }
                }
                else {
                    return reg.replace(config.index, "$1").split(config.arraysep).map((chunk) => {
                        //@ts-ignore
                        if (isNaN(chunk * 1) === false)
                            chunk *= 1;
                        return chunk;
                    });
                }
            }
            else if (config.prop.test(reg)) {
                let mat = reg.match(config.prop);
                reg = reg.replace(config.prop, '');
                let ret = this.getReg(reg);
                let t = mat[0].replace(config.prop, "$1"), tmp = (ret instanceof Scope) ? ret.getReg(t) : ret[t];
                return typeof tmp === "function" ? tmp.bind(ret) : tmp;
            }
            else if (config.str.test(reg)) {
                return reg.replace(config.str, "$1");
            }
            return this.registers.has(reg) ? this.registers.get(reg) : (this.scopes.has(reg) ? this.scopes.get(reg) : 0);
        } //getReg
        setReg(reg, value) {
            if (config.index.test(reg)) {
                if (reg.replace(config.index, '')) {
                    let mat = reg.match(config.index);
                    reg = reg.replace(config.index, '');
                    let t = mat[0].replace(config.index, "$1"), tmp = this.getReg(reg);
                    //@ts-ignore
                    if (isNaN(t * 1) === false)
                        t *= 1;
                    if (typeof t === "number") {
                        if (tmp instanceof Scope) {
                            return tmp.setReg(t, value);
                        }
                        else {
                            tmp[t] = value;
                            return this.setReg(reg, tmp);
                        }
                    }
                    else if (config.str.test(t)) { //D?
                        if (tmp instanceof Scope) {
                            return tmp.setReg(t.replace(config.str, "$1"), value);
                        }
                        else {
                            tmp[t.replace(config.str, "$1")] = value;
                            return this.setReg(reg, tmp);
                        }
                    }
                    else {
                        if (tmp instanceof Scope) {
                            return tmp.setReg(this.getReg(t), value);
                        }
                        else {
                            tmp[this.getReg(t)] = value;
                            return this.setReg(reg, tmp);
                        }
                    }
                }
                else {
                    throw JSAErrors.EBADSYN;
                }
            }
            else if (config.prop.test(reg)) {
                let mat = reg.match(config.prop);
                reg = reg.replace(config.prop, '');
                let t = mat[0].replace(config.prop, "$1"), tmp = this.getReg(reg);
                if (tmp instanceof Scope) {
                    return tmp.setReg(t, value);
                }
                else {
                    tmp[t] = value;
                    return this.setReg(reg, tmp);
                }
            }
            return this.registers.set(reg, value);
        } //setReg
        makeObj() {
            let nscp = new Scope();
            Object.assign(nscp, this);
            return nscp;
        } //makeObj
        static load(code, name, isAsync) {
            code = `${config.startsmbl}${config.jmplab}${config.endl.repeat(2)}${code}${config.endl.repeat(2)}${config.endsmbl}${config.jmplab}${config.endl}`;
            let lines = code.split(config.endl_r), subscope = -1, nscope = '', nscopename = '', nscopeasync, scope = new Scope(name, isAsync), lncnt = 0;
            for (let line of lines) {
                line = line.replace(config.comment, '').trim();
                if (subscope === -1 && config.isScope.test(line)) {
                    subscope++;
                    let parts = line.split(config.sep_r);
                    if (parts.length > 3)
                        throws(JSAErrors.EBADSYN, `Too many parameters on declaration, need at most 3. (${lncnt})${os_1.EOL}${line}`);
                    if (parts.length < 2)
                        throws(JSAErrors.EBADSYN, `Too little parameters on declaration, need at least 2. (${lncnt})${os_1.EOL}${line}`);
                    if (parts.length === 3 && config.asn !== parts[0])
                        throws(JSAErrors.EBADSYN, `First parameter must be 'asn', second 'def' and third the name. (${lncnt})${os_1.EOL}${line}`);
                    if (parts.length === 3)
                        nscopeasync = true;
                    if (config.isScope.test(nscopename = parts[parts.length - 1]))
                        throws(JSAErrors.EBADN);
                }
                else if (subscope > -1 && config.isScopeEnd !== line) {
                    nscope += line + config.endl;
                    if (config.isScope.test(line))
                        subscope++;
                }
                else if (subscope > -1) {
                    if (--subscope === -1) {
                        scope.scopes.set(nscopename, Scope.load(nscope, nscopename, nscopeasync));
                    }
                    else if (subscope < -1) {
                        throws(JSAErrors.EBADS, line);
                    }
                    else {
                        nscope += line + config.endl;
                    }
                }
                else {
                    if (config.isScopeEnd === line)
                        throws(JSAErrors.EBADS, line);
                    scope.add(line);
                }
                lncnt++;
            }
            if (subscope !== -1)
                throws(JSAErrors.EBADS);
            return scope;
        } //load
    } //Scope
    tslib_1.__decorate([
        enumerable,
        tslib_1.__metadata("design:type", Object)
    ], Scope.prototype, "_streams", void 0);
    JSA.Scope = Scope;
    class Instruction {
        constructor(inst, parent) {
            this.parent = parent;
            this._params = inst.split(config.sep_r).map(part => part.replace(config.escs, ''));
        } //ctor
        static parse(line, parent) {
            let ins;
            if ((ins = Array.from(Instruction.mappings.entries()).find((arr) => arr[0].test(line))) && ins[1]) {
                return new (ins[1])(line, parent);
            }
            else {
                return new Instruction(line, parent);
            }
        } //parse
        //@Override
        async call() {
            return throws(JSAErrors.EINSNOTEX, `${this._params.join(config.sep)}`);
        } //call
    } //Instruction
    JSA.Instruction = Instruction;
    let Instructions;
    (function (Instructions) {
        class Add extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.to = "acc";
                this.num = 1;
                if (this._params.length > 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the value.${os_1.EOL}${this._params.join(config.sep)}`);
                this.num = this._params[1] || this.num;
                if (isNaN(this.num * 1) === false) {
                    //@ts-ignore
                    this.num *= 1;
                }
            } //ctor
            async call() {
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) + this.num);
                }
                else {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) + this.parent.getReg(this.num));
                }
                return false;
            } //call
        } //Add
        Instructions.Add = Add;
        class Sub extends Add {
            constructor(inst, parent) {
                super(inst, parent);
            } //ctor
            async call() {
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) - this.num);
                }
                else {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) - this.parent.getReg(this.num));
                }
                return false;
            } //call
        } //Sub
        Instructions.Sub = Sub;
        class Mul extends Add {
            constructor(inst, parent) {
                super(inst, parent);
                //@Override
                this.num = 2;
            } //ctor
            async call() {
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) * this.num);
                }
                else {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) * this.parent.getReg(this.num));
                }
                return false;
            } //call
        } //Mul
        Instructions.Mul = Mul;
        class Div extends Mul {
            constructor(inst, parent) {
                super(inst, parent);
            } //ctor
            async call() {
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) / this.num);
                }
                else {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) / this.parent.getReg(this.num));
                }
                return false;
            } //call
        } //Div
        Instructions.Div = Div;
        class Mod extends Div {
            constructor(inst, parent) {
                super(inst, parent);
            } //ctor
            async call() {
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) % this.num);
                }
                else {
                    this.parent.setReg(this.to, this.parent.getReg(this.to) % this.parent.getReg(this.num));
                }
                return false;
            } //call
        } //Mod
        Instructions.Mod = Mod;
        class Mov extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.from = 0;
                this.to = "acc";
                if (this._params.length < 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be at least 1, the value.${os_1.EOL}${this._params.join(config.sep)}`);
                if (this._params.length > 3)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 2, the address and the value.${os_1.EOL}${this._params.join(config.sep)}`);
                if (this._params.length === 3) {
                    this.to = this._params[1];
                    this.from = this._params[2];
                }
                else {
                    this.from = this._params[1];
                }
                if (isNaN(this.from * 1) === false) {
                    //@ts-ignore
                    this.from *= 1;
                }
            } //ctor
            async call() {
                if (typeof this.from === "number") {
                    this.parent.setReg(this.to, this.from);
                }
                else if (typeof this.from === "string") {
                    this.parent.setReg(this.to, this.parent.getReg(this.from));
                }
                return false;
            } //call
        } //Mov
        Instructions.Mov = Mov;
        class Slp extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.interval = 1;
                if (this._params.length > 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the interval.${os_1.EOL}${this._params.join(config.sep)}`);
                this.interval = this._params[1];
                if (isNaN(this.interval * 1) === false) {
                    //@ts-ignore
                    this.interval *= 1;
                }
            } //ctor
            async call() {
                let intrv = 1;
                if (typeof this.interval === "string") {
                    intrv = this.parent.getReg(this.interval);
                }
                else {
                    intrv = this.interval;
                }
                return new Promise(((res, rej) => setTimeout(res, intrv)).bind(this));
            } //call
        } //Slp
        Instructions.Slp = Slp;
        class Label extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                if (this._params.length !== 1)
                    throws(JSAErrors.EBADCAL, `Must follow the format 'label${config.jmplab}'.${os_1.EOL}${this._params.join(config.sep)}`);
                this.name = this._params[0];
            } //ctor
            async call() {
                return false;
            } //call
        } //Label
        Instructions.Label = Label;
        class Jmp extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                if (this._params.length > 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the label.${os_1.EOL}${this._params.join(config.sep)}`);
                this.to = this._params[1];
                if (isNaN(this.to * 1) === false) {
                    //@ts-ignore
                    this.to *= 1;
                }
            } //ctor
            async call() {
                if (typeof this.to === "string") {
                    if (this.to.endsWith(config.jmplab)) {
                        let tmp = this.parent.instructions.findIndex((ins) => (ins instanceof Label) && ins.name === this.to); //first-time-initialization happens upon execution to ensure labels all exist
                        if (tmp < 0)
                            throws(JSAErrors.EBADJMP, `Label ${this.to} does not exist.`);
                        this.parent.setReg("jmb", this.parent.getReg("jmx"));
                        this.parent.setReg("jmx", this.to = tmp);
                    }
                    else {
                        let lab = this.parent.registers.has(this.to) ? this.parent.getReg(this.to) : (config.startsmbl + config.jmplab), tmp = this.parent.instructions.findIndex((ins) => (ins instanceof Label) && ins.name === lab);
                        if (tmp < 0)
                            throws(JSAErrors.EBADJMP, `Label ${this.to} does not exist.`);
                        this.parent.setReg("jmb", this.parent.getReg("jmx"));
                        this.parent.setReg("jmx", tmp);
                    }
                }
                else {
                    if (this.to < 0 || this.to >= this.parent.instructions.length)
                        throws(JSAErrors.EBADJMP, `Invalid jump to ${this.to}`);
                    this.parent.setReg("jmb", this.parent.getReg("jmx"));
                    this.parent.setReg("jmx", this.to);
                }
                return false;
            } //call
        } //Jmp
        Instructions.Jmp = Jmp;
        class If extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.eq = false;
                this.from = "acc";
                this.to = 0;
                if (this._params.length > 3)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 2, the address and the value.${os_1.EOL}${this._params.join(config.sep)}`);
                if (this._params[0].endsWith('e')) {
                    this.eq = true;
                }
                if (this._params.length === 3) {
                    this.from = this._params[1];
                    this.to = this._params[2];
                }
                else {
                    this.to = this._params[1];
                }
                if (isNaN(this.to) === false) {
                    //@ts-ignore
                    this.to *= 1;
                }
            } //ctor
            async call() {
                if (typeof this.to === "number") {
                    if (this.eq) {
                        if (this.parent.getReg(this.from) != this.to)
                            this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
                    }
                    else {
                        if (this.parent.getReg(this.from) < this.to)
                            this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
                    }
                }
                else {
                    if (this.eq) {
                        if (this.parent.getReg(this.from) == this.parent.getReg(this.to))
                            this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
                    }
                    else {
                        if (this.parent.getReg(this.from) < this.parent.getReg(this.to))
                            this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
                    }
                }
                return false;
            } //call
        } //If
        Instructions.If = If;
        class Prt extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.default = "acc";
            } //ctor
            async call() {
                let prec = this._params.slice(1);
                if (prec.length) {
                    for (let param of prec) {
                        if (config.str.test(param)) {
                            this.parent._streams.output.write(param.replace(config.str, "$1"));
                        }
                        else {
                            this.parent._streams.output.write(this.parent.getReg(param) + '');
                        }
                    }
                }
                else {
                    this.parent._streams.output.write(this.parent.getReg(this.default) + '');
                }
                return false;
            } //call
        } //Prt
        Instructions.Prt = Prt;
        class Inp extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.to = "acc";
                if (this._params.length !== 1)
                    throws(JSAErrors.EBADCAL, `Parameters must be exactly 0.${os_1.EOL}${this._params.join(config.sep)}`);
            } //ctor
            async call() {
                return new Promise((res, rej) => {
                    this.parent._streams.input.once("readable", () => {
                        this.parent.setReg(this.to, this.parent._streams.input.read(1));
                        res(false);
                    });
                });
            } //call
        } //Inp
        Instructions.Inp = Inp;
        class Method extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.to = "acc";
                this.args = "ARGS";
                this.isAw = false;
                if (this._params[0] === config.aw) {
                    this.isAw = true;
                    this.name = this._params[1];
                }
                else {
                    this.name = this._params[0];
                }
            } //ctor
            async call() {
                let scp;
                if ((scp = this.parent.getReg(this.name)) instanceof Scope) {
                    if (this._params.length > 1) {
                        this._params.slice(this.isAw ? 2 : 1).forEach((param, idx) => {
                            scp.setReg(this.args + `[${idx}]`, param);
                        });
                        if (this.isAw) {
                            await scp.call();
                        }
                        else {
                            setImmediate(scp.call);
                        }
                    }
                    else {
                        this.parent.setReg(this.to, scp.makeObj());
                    }
                }
                else if (typeof scp === "function") {
                    let dat;
                    if (this.isAw) {
                        dat = await scp(...this._params.slice(2));
                    }
                    else {
                        dat = scp(...this._params.slice(1));
                    }
                    this.parent.setReg(this.to, dat);
                }
                else {
                    throws(JSAErrors.EBADS, `${this.name} is not a scope.`);
                }
                return false;
            } //call
        } //Method
        Instructions.Method = Method;
    })(Instructions = JSA.Instructions || (JSA.Instructions = {})); //Instructions
    Instruction.mappings = new Map([
        [/^add( .+)?$/, Instructions["Add"]],
        [/^sub( .+)?$/, Instructions["Sub"]],
        [/^mul (.+)$/, Instructions["Mul"]],
        [/^div (.+)$/, Instructions["Div"]],
        [/^mod( .+)?$/, Instructions["Mod"]],
        [/^mov (.+){1,2}$/, Instructions["Mov"]],
        [/^slp( .+)?$/, Instructions["Slp"]],
        [/^jmp (.+)$/, Instructions["Jmp"]],
        [/^inc (.+){1,2}$/, Instructions["Inc"]],
        [/^if(e|l)( .+){0,2}$/, Instructions["If"]],
        [/^prt( .+)?$/, Instructions["Prt"]],
        [/^inp$/, Instructions["Inp"]],
        [/^(.+):$/, Instructions["Label"]],
        [/^./, Instructions["Method"]] //method call +[aw]
    ]);
    async function load(file) {
        if (path_1.extname(file) === '')
            file += config.extname;
        return new Promise((res, rej) => {
            fs.readFile(file, (err, data) => {
                if (err) {
                    rej(err);
                }
                else {
                    let scp = Scope.load(data.toString());
                    scp.setReg("_isMain_", 1);
                    res(scp);
                }
            });
        });
    } //load
    JSA.load = load;
    function throws(err, message) {
        if (message)
            err.message += os_1.EOL.repeat(2) + message;
        throw err;
    } //throws
    //@Decorator
    function enumerable(target, propertyKey) {
        Object.defineProperty(target, propertyKey, {
            enumerable: false,
            configurable: true,
            writable: true
        });
    } //enumerable
})(JSA = exports.JSA || (exports.JSA = {})); //JSA
exports.default = JSA;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2pzYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7OztBQUViLHFEQUErQjtBQUMvQiwyQkFBeUI7QUFDekIsbUNBQXNDO0FBQ3RDLCtCQUErQjtBQUcvQixlQUFlO0FBRWYsSUFBYyxHQUFHLENBdXRCaEI7QUF2dEJELFdBQWMsR0FBRztJQUVoQixJQUFpQixNQUFNLENBdUJ0QjtJQXZCRCxXQUFpQixNQUFNO1FBQ1gsY0FBTyxHQUFXLE1BQU0sQ0FBQztRQUN6QixhQUFNLEdBQVcsR0FBRyxDQUFDO1FBQ3JCLGVBQVEsR0FBVyxHQUFHLENBQUM7UUFDdkIsZ0JBQVMsR0FBVyxVQUFVLENBQUM7UUFDL0IsY0FBTyxHQUFXLFFBQVEsQ0FBQztRQUMzQixXQUFJLEdBQVcsVUFBVSxDQUFDO1FBQzFCLFVBQUcsR0FBVyxLQUFLLENBQUM7UUFDcEIsU0FBRSxHQUFXLElBQUksQ0FBQztRQUNsQixTQUFFLEdBQVcsS0FBSyxDQUFDO1FBQ25CLGlCQUFVLEdBQVcsS0FBSyxDQUFDO1FBQzNCLFVBQUcsR0FBVyxHQUFHLENBQUM7UUFDbEIsV0FBSSxHQUFXLFFBQUcsQ0FBQztRQUNuQixZQUFLLEdBQVcsWUFBWSxDQUFDO1FBQzdCLGFBQU0sR0FBVyxhQUFhLENBQUM7UUFFMUMsa0JBQWtCO1FBQ1AsY0FBTyxHQUFXLElBQUksTUFBTSxDQUFDLElBQUksR0FBRyxPQUFBLEdBQUcsR0FBRyxNQUFNLEdBQUcsT0FBQSxFQUFFLEdBQUcsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ25FLGNBQU8sR0FBVyxRQUFRLENBQUE7UUFDMUIsWUFBSyxHQUFXLHFCQUFxQixDQUFDO1FBQ3RDLFVBQUcsR0FBVyxrQkFBa0IsQ0FBQztRQUNqQyxXQUFJLEdBQVcsV0FBVyxDQUFDO1FBQzNCLFdBQUksR0FBVyxhQUFhLENBQUE7SUFDeEMsQ0FBQyxFQXZCZ0IsTUFBTSxH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Q0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBVSxFQUFFLElBQVksRUFBRSxFQUFFO2dCQUM5QyxJQUFJLEdBQUcsRUFBRTtvQkFDUixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ1Q7cUJBQU07b0JBQ04sSUFBSSxHQUFHLEdBQVUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDN0MsR0FBRyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDVDtZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsTUFBTTtJQWRjLFFBQUksT0FjekIsQ0FBQTtJQUVELFNBQVMsTUFBTSxDQUFDLEdBQVUsRUFBRSxPQUFnQjtRQUMzQyxJQUFJLE9BQU87WUFBRSxHQUFHLENBQUMsT0FBTyxJQUFJLFFBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDO1FBRXBELE1BQU0sR0FBRyxDQUFDO0lBQ1gsQ0FBQyxDQUFDLFFBQVE7SUFFVixZQUFZO0lBQ1osU0FBUyxVQUFVLENBQUMsTUFBYyxFQUFFLFdBQTRCO1FBQy9ELE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFdBQVcsRUFBRztZQUMzQyxVQUFVLEVBQUUsS0FBSztZQUNqQixZQUFZLEVBQUUsSUFBSTtZQUNsQixRQUFRLEVBQUUsSUFBSTtTQUNkLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxZQUFZO0FBRWYsQ0FBQyxFQXZ0QmEsR0FBRyxHQUFILFdBQUcsS0FBSCxXQUFHLFFBdXRCaEIsQ0FBQyxLQUFLO0FBRVAsa0JBQWUsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnMtZXh0cmFcIjtcclxuaW1wb3J0IHsgRU9MIH0gZnJvbSBcIm9zXCI7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcclxuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gXCJwYXRoXCI7XHJcblxyXG5cclxuLy9JTVBMOiBvYmplY3RzXHJcblxyXG5leHBvcnQgbW9kdWxlIEpTQSB7XHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgY29uZmlnIHtcclxuXHRcdGV4cG9ydCB2YXIgZXh0bmFtZTogc3RyaW5nID0gXCIuanNhXCI7XHJcblx0XHRleHBvcnQgdmFyIGptcGxhYjogc3RyaW5nID0gJzonO1xyXG5cdFx0ZXhwb3J0IHZhciBhcnJheXNlcDogc3RyaW5nID0gJywnO1xyXG5cdFx0ZXhwb3J0IHZhciBzdGFydHNtYmw6IHN0cmluZyA9IFwiX19TVEFSVF9cIjtcclxuXHRcdGV4cG9ydCB2YXIgZW5kc21ibDogc3RyaW5nID0gXCJfX0VORF9cIjtcclxuXHRcdGV4cG9ydCB2YXIgYmFzZTogc3RyaW5nID0gXCJfX0JBU0VfX1wiO1xyXG5cdFx0ZXhwb3J0IHZhciBhc246IHN0cmluZyA9IFwiYXNuXCI7XHJcblx0XHRleHBvcnQgdmFyIGF3OiBzdHJpbmcgPSBcImF3XCI7XHJcblx0XHRleHBvcnQgdmFyIGZuOiBzdHJpbmcgPSBcImRlZlwiO1xyXG5cdFx0ZXhwb3J0IHZhciBpc1Njb3BlRW5kOiBzdHJpbmcgPSBcImVuZFwiO1xyXG5cdFx0ZXhwb3J0IHZhciBzZXA6IHN0cmluZyA9ICcgJztcclxuXHRcdGV4cG9ydCB2YXIgZW5kbDogc3RyaW5nID0gRU9MO1xyXG5cdFx0ZXhwb3J0IHZhciBzZXBfcjogUmVnRXhwID0gLyg/PCFcXFxcKSAvZ207XHJcblx0XHRleHBvcnQgdmFyIGVuZGxfcjogUmVnRXhwID0gLyg/PCFcXFxcKVxcbi9nbTtcclxuXHJcblx0XHQvL1NFQ09ORCBFWFBBTlNJT05cclxuXHRcdGV4cG9ydCB2YXIgaXNTY29wZTogUmVnRXhwID0gbmV3IFJlZ0V4cChcIl4oXCIgKyBhc24gKyBcIiApPyhcIiArIGZuICsgXCIpID9cIiwgJycpO1xyXG5cdFx0ZXhwb3J0IHZhciBjb21tZW50OiBSZWdFeHAgPSAvIy4qJC9pc1xyXG5cdFx0ZXhwb3J0IHZhciBpbmRleDogUmVnRXhwID0gL1xcWyguKylcXF18XFwoKC4rKVxcKS9tcztcclxuXHRcdGV4cG9ydCB2YXIgc3RyOiBSZWdFeHAgPSAvXlsnXCJdKC4rKVsnXCJdJC9tcztcclxuXHRcdGV4cG9ydCB2YXIgcHJvcDogUmVnRXhwID0gL1xcLiguKykkL21zO1xyXG5cdFx0ZXhwb3J0IHZhciBlc2NzOiBSZWdFeHAgPSAvKD88IVxcXFwpXFxcXC9nbVxyXG5cdH0gLy9jb25maWdcclxuXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBKU0FFcnJvcnMge1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQUROOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBOYW1lLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEUzogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgU2NvcGUuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURDQUw6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIHBhcmFtZXRlcnMuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURTWU46IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIFN5bnRheC5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUlOU05PVEVYOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkluc3RydWN0aW9uIGRvZXMgbm90IGV4aXN0LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFESk1QOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBKdW1wLlwiKTtcclxuXHR9IC8vSlNBRXJyb3JzXHJcblxyXG5cclxuXHRleHBvcnQgY2xhc3MgU2NvcGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuXHRcdHByb3RlY3RlZCByZWFkb25seSBzY29wZXM6IE1hcDxzdHJpbmcsIFNjb3BlPiA9IG5ldyBNYXA8c3RyaW5nLCBTY29wZT4oKTtcclxuXHRcdHJlYWRvbmx5IHJlZ2lzdGVyczogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KFtcclxuXHRcdFx0W1wiYWNjXCIsIDBdLFxyXG5cdFx0XHRbXCJqbXhcIiwgMF0sXHJcblx0XHRcdFtcImptYlwiLCAwXSxcclxuXHRcdFx0W1wiRU5ETFwiLCBFT0xdLFxyXG5cdFx0XHRbXCJBUkdTXCIsIFtdXSwgIC8vbG9hZCBmcm9tIENMST9cclxuXHRcdFx0W1wiX21hdGhcIiwgTWF0aF0sXHJcblx0XHRcdFtcIl9kYXRlXCIsIERhdGVdLFxyXG5cdFx0XHRbXCJudWxsXCIsIG51bGxdXHJcblx0XHRdKTtcclxuXHRcdHJlYWRvbmx5IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFsgXTtcclxuXHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgaXNBc3luYzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG5hbWU6IHN0cmluZyA9IGNvbmZpZy5iYXNlO1xyXG5cclxuXHRcdEBlbnVtZXJhYmxlXHJcblx0XHRyZWFkb25seSBfc3RyZWFtczoge1xyXG5cdFx0XHRpbnB1dDogTm9kZUpTLlJlYWRTdHJlYW0sXHJcblx0XHRcdG91dHB1dDogTm9kZUpTLldyaXRlU3RyZWFtLFxyXG5cdFx0XHRlcnJvcjogTm9kZUpTLldyaXRlU3RyZWFtXHJcblx0XHR9ID0ge1xyXG5cdFx0XHRpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuXHRcdFx0b3V0cHV0OiBwcm9jZXNzLnN0ZG91dCxcclxuXHRcdFx0ZXJyb3I6IHByb2Nlc3Muc3RkZXJyXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5hbWU/OiBzdHJpbmcsIGlzQXN5bmM/OiBib29sZWFuKSB7XHJcblx0XHRcdHN1cGVyKCk7XHJcblx0XHRcdHRoaXMubmFtZSA9IG5hbWUgfHwgdGhpcy5uYW1lO1xyXG5cdFx0XHR0aGlzLmlzQXN5bmMgPSBpc0FzeW5jIHx8IHRoaXMuaXNBc3luYztcclxuXHJcblx0XHRcdHRoaXMuX3N0cmVhbXMuaW5wdXQuc2V0UmF3TW9kZSh0cnVlKTtcclxuXHRcdFx0dGhpcy5fc3RyZWFtcy5pbnB1dC5yZXN1bWUoKTtcclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTx2b2lkPiB7XHJcblx0XHRcdGZvciAoOyB0aGlzLnJlZ2lzdGVycy5nZXQoXCJqbXhcIikgPCB0aGlzLmluc3RydWN0aW9ucy5sZW5ndGg7IHRoaXMucmVnaXN0ZXJzLnNldChcImpteFwiLCB0aGlzLnJlZ2lzdGVycy5nZXQoXCJqbXhcIikgKyAxKSkge1xyXG5cdFx0XHRcdGlmIChhd2FpdCB0aGlzLmluc3RydWN0aW9uc1t0aGlzLnJlZ2lzdGVycy5nZXQoXCJqbXhcIildLmNhbGwoKSkgYnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0aGlzLm5hbWUgPT09IGNvbmZpZy5iYXNlKSBwcm9jZXNzLmV4aXQoKTtcclxuXHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0cHJvdGVjdGVkIGFkZChpbnN0OiBJbnN0cnVjdGlvbiB8IHN0cmluZyk6IEluc3RydWN0aW9uIHwgc3RyaW5nIHtcclxuXHRcdFx0aWYgKHR5cGVvZiBpbnN0ID09PSBcInN0cmluZ1wiKSB7XHJcblx0XHRcdFx0aWYgKGluc3QgPT09ICcnKSByZXR1cm4gaW5zdDtcclxuXHJcblx0XHRcdFx0aW5zdCA9IEluc3RydWN0aW9uLnBhcnNlKGluc3QsIHRoaXMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmluc3RydWN0aW9ucy5wdXNoKGluc3QpO1xyXG5cclxuXHRcdFx0cmV0dXJuIGluc3Q7XHJcblx0XHR9IC8vYWRkXHJcblxyXG5cdFx0cHVibGljIGdldFJlZyhyZWc6IHN0cmluZyk6IGFueSB7XHJcblx0XHRcdGlmIChjb25maWcuaW5kZXgudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0aWYgKHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgJycpKSB7XHJcblx0XHRcdFx0XHRsZXQgbWF0OiBzdHJpbmdbXSA9IHJlZy5tYXRjaChjb25maWcuaW5kZXgpO1xyXG5cclxuXHRcdFx0XHRcdHJlZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgJycpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRsZXQgdDogc3RyaW5nID0gbWF0WzBdLnJlcGxhY2UoY29uZmlnLmluZGV4LCBcIiQxXCIpO1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50ICogMSkgPT09IGZhbHNlKSB0ICo9IDE7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGlmICh0eXBlb2YgdCA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0XHRsZXQgdG1wID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHR5cGVvZiB0bXBbdF0gPT09IFwiZnVuY3Rpb25cIiA/IHRtcFt0XS5iaW5nKHRtcCkgOiB0bXBbdF07XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5zdHIudGVzdCh0KSkgeyAgLy9EP1xyXG5cdFx0XHRcdFx0XHR0ID0gdC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIik7ICAvL3doeSBub3QgdXNlIC5wcm9wIHN5bnRheCBpbnN0ZWFkP1xyXG5cdFx0XHRcdFx0XHRsZXQgcmV0OiBhbnkgPSB0aGlzLmdldFJlZyhyZWcpLFxyXG5cdFx0XHRcdFx0XHRcdHRtcCA9IChyZXQgaW5zdGFuY2VvZiBTY29wZSkgPyByZXQuZ2V0UmVnKHQpIDogcmV0W3RdO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuIHR5cGVvZiB0bXAgPT09IFwiZnVuY3Rpb25cIiA/IHRtcC5iaW5kKHJldCkgOiB0bXA7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRsZXQgdG1wID0gdGhpcy5nZXRSZWcocmVnKSxcclxuXHRcdFx0XHRcdFx0XHRcdGdvdCA9IHRtcFt0aGlzLmdldFJlZyh0KV07XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHlwZW9mIGdvdCA9PT0gXCJmdW5jdGlvblwiID8gZ290LmJpbmQodG1wKSA6IGdvdDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKS5zcGxpdChjb25maWcuYXJyYXlzZXApLm1hcCgoY2h1bms6IHN0cmluZykgPT4ge1xyXG5cdFx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+Y2h1bmsgKiAxKSA9PT0gZmFsc2UpIGNodW5rICo9IDE7XHJcblx0XHRcdFx0XHRcdHJldHVybiBjaHVuaztcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChjb25maWcucHJvcC50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRsZXQgbWF0OiBzdHJpbmdbXSA9IHJlZy5tYXRjaChjb25maWcucHJvcCk7XHJcblxyXG5cdFx0XHRcdHJlZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5wcm9wLCAnJyk7XHJcblxyXG5cdFx0XHRcdGxldCByZXQ6IGFueSA9IHRoaXMuZ2V0UmVnKHJlZyk7XHJcblxyXG5cdFx0XHRcdGxldCB0OiBzdHJpbmcgPSBtYXRbMF0ucmVwbGFjZShjb25maWcucHJvcCwgXCIkMVwiKSxcclxuXHRcdFx0XHRcdHRtcCA9IChyZXQgaW5zdGFuY2VvZiBTY29wZSkgPyByZXQuZ2V0UmVnKHQpIDogcmV0W3RdO1xyXG5cclxuXHRcdFx0XHRyZXR1cm4gdHlwZW9mIHRtcCA9PT0gXCJmdW5jdGlvblwiID8gdG1wLmJpbmQocmV0KSA6IHRtcDtcclxuXHRcdFx0fSBlbHNlIGlmIChjb25maWcuc3RyLnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdHJldHVybiByZWcucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gdGhpcy5yZWdpc3RlcnMuaGFzKHJlZykgPyB0aGlzLnJlZ2lzdGVycy5nZXQocmVnKSA6ICh0aGlzLnNjb3Blcy5oYXMocmVnKSA/IHRoaXMuc2NvcGVzLmdldChyZWcpIDogMCk7XHJcblx0XHR9IC8vZ2V0UmVnXHJcblxyXG5cdFx0cHVibGljIHNldFJlZyhyZWc6IHN0cmluZywgdmFsdWU6IGFueSk6IE1hcDxzdHJpbmcsIGFueT4geyAgLy9mb3IgZnVuY3M/XHJcblx0XHRcdGlmIChjb25maWcuaW5kZXgudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0aWYgKHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgJycpKSB7XHJcblx0XHRcdFx0XHRsZXQgbWF0OiBzdHJpbmdbXSA9IHJlZy5tYXRjaChjb25maWcuaW5kZXgpO1xyXG5cdFx0XHRcdFx0cmVnID0gcmVnLnJlcGxhY2UoY29uZmlnLmluZGV4LCAnJyk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IHQgPSBtYXRbMF0ucmVwbGFjZShjb25maWcuaW5kZXgsIFwiJDFcIiksXHJcblx0XHRcdFx0XHRcdHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyk7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdGlmIChpc05hTig8bnVtYmVyPjx1bmtub3duPnQgKiAxKSA9PT0gZmFsc2UpIHQgKj0gMTtcclxuXHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHQgPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodCwgdmFsdWUpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRtcFt0XSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFJlZyhyZWcsIHRtcCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnN0ci50ZXN0KHQpKSB7ICAvL0Q/XHJcblx0XHRcdFx0XHRcdGlmICh0bXAgaW5zdGFuY2VvZiBTY29wZSkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0bXAuc2V0UmVnKHQucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpLCB2YWx1ZSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dG1wW3QucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFJlZyhyZWcsIHRtcCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICh0bXAgaW5zdGFuY2VvZiBTY29wZSkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0bXAuc2V0UmVnKHRoaXMuZ2V0UmVnKHQpLCB2YWx1ZSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dG1wW3RoaXMuZ2V0UmVnKHQpXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFJlZyhyZWcsIHRtcCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhyb3cgSlNBRXJyb3JzLkVCQURTWU47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5wcm9wLnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGxldCBtYXQ6IHN0cmluZ1tdID0gcmVnLm1hdGNoKGNvbmZpZy5wcm9wKTtcclxuXHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcucHJvcCwgJycpO1xyXG5cclxuXHRcdFx0XHRsZXQgdCA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5wcm9wLCBcIiQxXCIpLFxyXG5cdFx0XHRcdFx0dG1wID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHJcblx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdG1wLnNldFJlZyh0LCB2YWx1ZSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRtcFt0XSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aGlzLnJlZ2lzdGVycy5zZXQocmVnLCB2YWx1ZSk7XHJcblx0XHR9IC8vc2V0UmVnXHJcblxyXG5cdFx0cHVibGljIG1ha2VPYmooKTogU2NvcGUge1xyXG5cdFx0XHRsZXQgbnNjcDogU2NvcGUgPSBuZXcgU2NvcGUoKTtcclxuXHJcblx0XHRcdE9iamVjdC5hc3NpZ24obnNjcCwgdGhpcyk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gbnNjcDtcclxuXHRcdH0gLy9tYWtlT2JqXHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBsb2FkKGNvZGU6IHN0cmluZywgbmFtZT86IHN0cmluZywgaXNBc3luYz86IGJvb2xlYW4pOiBTY29wZSB7ICAvL3Bhc3Mgc2NvcGUgYm9keSBhcyBzdHJpbmdcclxuXHRcdFx0Y29kZSA9IGAke2NvbmZpZy5zdGFydHNtYmx9JHtjb25maWcuam1wbGFifSR7Y29uZmlnLmVuZGwucmVwZWF0KDIpfSR7Y29kZX0ke2NvbmZpZy5lbmRsLnJlcGVhdCgyKX0ke2NvbmZpZy5lbmRzbWJsfSR7Y29uZmlnLmptcGxhYn0ke2NvbmZpZy5lbmRsfWA7XHJcblxyXG5cdFx0XHRsZXQgbGluZXMgPSBjb2RlLnNwbGl0KGNvbmZpZy5lbmRsX3IpLFxyXG5cdFx0XHRcdHN1YnNjb3BlOiBudW1iZXIgPSAtMSxcclxuXHRcdFx0XHRuc2NvcGU6IHN0cmluZyA9ICcnLFxyXG5cdFx0XHRcdG5zY29wZW5hbWU6IHN0cmluZyA9ICcnLFxyXG5cdFx0XHRcdG5zY29wZWFzeW5jOiBib29sZWFuLFxyXG5cdFx0XHRcdHNjb3BlOiBTY29wZSA9IG5ldyBTY29wZShuYW1lLCBpc0FzeW5jKSxcclxuXHRcdFx0XHRsbmNudDogbnVtYmVyID0gMDtcclxuXHJcblx0XHRcdGZvciAobGV0IGxpbmUgb2YgbGluZXMpIHtcclxuXHRcdFx0XHRsaW5lID0gbGluZS5yZXBsYWNlKGNvbmZpZy5jb21tZW50LCAnJykudHJpbSgpO1xyXG5cclxuXHRcdFx0XHRpZiAoc3Vic2NvcGUgPT09IC0xICYmIGNvbmZpZy5pc1Njb3BlLnRlc3QobGluZSkpIHtcclxuXHRcdFx0XHRcdHN1YnNjb3BlKys7XHJcblxyXG5cdFx0XHRcdFx0bGV0IHBhcnRzOiBzdHJpbmdbXSA9IGxpbmUuc3BsaXQoY29uZmlnLnNlcF9yKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEU1lOLCBgVG9vIG1hbnkgcGFyYW1ldGVycyBvbiBkZWNsYXJhdGlvbiwgbmVlZCBhdCBtb3N0IDMuICgke2xuY250fSkke0VPTH0ke2xpbmV9YCk7XHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoIDwgMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEU1lOLCBgVG9vIGxpdHRsZSBwYXJhbWV0ZXJzIG9uIGRlY2xhcmF0aW9uLCBuZWVkIGF0IGxlYXN0IDIuICgke2xuY250fSkke0VPTH0ke2xpbmV9YCk7XHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoID09PSAzICYmIGNvbmZpZy5hc24gIT09IHBhcnRzWzBdKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTWU4sIGBGaXJzdCBwYXJhbWV0ZXIgbXVzdCBiZSAnYXNuJywgc2Vjb25kICdkZWYnIGFuZCB0aGlyZCB0aGUgbmFtZS4gKCR7bG5jbnR9KSR7RU9MfSR7bGluZX1gKTtcclxuXHRcdFx0XHRcdGlmIChwYXJ0cy5sZW5ndGggPT09IDMpIG5zY29wZWFzeW5jID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGlmIChjb25maWcuaXNTY29wZS50ZXN0KG5zY29wZW5hbWUgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSkpIHRocm93cyhKU0FFcnJvcnMuRUJBRE4pO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoc3Vic2NvcGUgPiAtMSAmJiBjb25maWcuaXNTY29wZUVuZCAhPT0gbGluZSkge1xyXG5cdFx0XHRcdFx0bnNjb3BlICs9IGxpbmUgKyBjb25maWcuZW5kbDtcclxuXHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGUudGVzdChsaW5lKSkgc3Vic2NvcGUrKztcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlID4gLTEpIHtcclxuXHRcdFx0XHRcdGlmICgtLXN1YnNjb3BlID09PSAtMSkge1xyXG5cdFx0XHRcdFx0XHRzY29wZS5zY29wZXMuc2V0KG5zY29wZW5hbWUsIFNjb3BlLmxvYWQobnNjb3BlLCBuc2NvcGVuYW1lLCBuc2NvcGVhc3luYykpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdWJzY29wZSA8IC0xKSB7XHJcblx0XHRcdFx0XHRcdHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGxpbmUpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bnNjb3BlICs9IGxpbmUgKyBjb25maWcuZW5kbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5pc1Njb3BlRW5kID09PSBsaW5lKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTLCBsaW5lKTtcclxuXHJcblx0XHRcdFx0XHRzY29wZS5hZGQobGluZSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRsbmNudCsrO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoc3Vic2NvcGUgIT09IC0xKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTKTtcclxuXHJcblx0XHRcdHJldHVybiBzY29wZTtcclxuXHRcdH0gLy9sb2FkXHJcblxyXG5cdH0gLy9TY29wZVxyXG5cclxuXHRleHBvcnQgY2xhc3MgSW5zdHJ1Y3Rpb24ge1xyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9wYXJhbXM6IHN0cmluZ1tdO1xyXG5cclxuXHRcdHB1YmxpYyBzdGF0aWMgbWFwcGluZ3M6IE1hcDxSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbj47XHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcHJvdGVjdGVkIHJlYWRvbmx5IHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0dGhpcy5fcGFyYW1zID0gaW5zdC5zcGxpdChjb25maWcuc2VwX3IpLm1hcChwYXJ0ID0+IHBhcnQucmVwbGFjZShjb25maWcuZXNjcywgJycpKTtcclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShsaW5lOiBzdHJpbmcsIHBhcmVudDogU2NvcGUpOiBJbnN0cnVjdGlvbiB7XHJcblx0XHRcdGxldCBpbnM6IFtSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbl07XHJcblxyXG5cdFx0XHRpZiAoKGlucyA9IEFycmF5LmZyb20oSW5zdHJ1Y3Rpb24ubWFwcGluZ3MuZW50cmllcygpKS5maW5kKChhcnIpOiBib29sZWFuID0+IGFyclswXS50ZXN0KGxpbmUpKSkgJiYgaW5zWzFdKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyAoaW5zWzFdKShsaW5lLCBwYXJlbnQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiBuZXcgSW5zdHJ1Y3Rpb24obGluZSwgcGFyZW50KTtcclxuXHRcdFx0fVxyXG5cdFx0fSAvL3BhcnNlXHJcblxyXG5cdFx0Ly9AT3ZlcnJpZGVcclxuXHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRyZXR1cm4gdGhyb3dzKEpTQUVycm9ycy5FSU5TTk9URVgsIGAke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0fSAvL2NhbGxcclxuXHJcblx0fSAvL0luc3RydWN0aW9uXHJcblxyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIEluc3RydWN0aW9ucyB7XHJcblx0XHRleHBvcnQgY2xhc3MgQWRkIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbnVtOiBudW1iZXIgfCBzdHJpbmcgPSAxO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgdmFsdWUuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy5udW0gPSB0aGlzLl9wYXJhbXNbMV0gfHwgdGhpcy5udW07XHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy5udW0gKiAxKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy5udW0gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICsgdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICsgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0FkZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBTdWIgZXh0ZW5kcyBBZGQge1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLSB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vU3ViXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIE11bCBleHRlbmRzIEFkZCB7XHJcblxyXG5cdFx0XHQvL0BPdmVycmlkZVxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbnVtOiBudW1iZXIgfCBzdHJpbmcgPSAyO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKiB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKiB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTXVsXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIERpdiBleHRlbmRzIE11bCB7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAvIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAvIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9EaXZcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTW9kIGV4dGVuZHMgRGl2IHtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICUgdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICUgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01vZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNb3YgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZnJvbTogbnVtYmVyIHwgc3RyaW5nIHwgQXJyYXk8YW55PiA9IDA7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nID0gXCJhY2NcIjtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoIDwgMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IGxlYXN0IDEsIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMiwgdGhlIGFkZHJlc3MgYW5kIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA9PT0gMykge1xyXG5cdFx0XHRcdFx0dGhpcy50byA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHRcdFx0XHRcdHRoaXMuZnJvbSA9IHRoaXMuX3BhcmFtc1syXTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy5mcm9tICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMuZnJvbSAqPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5mcm9tID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5mcm9tKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLmZyb20gPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01vdlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBTbHAgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgaW50ZXJ2YWw6IG51bWJlciB8IHN0cmluZyA9IDE7XHJcblx0XHRcdFxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBtb3N0IDEsIHRoZSBpbnRlcnZhbC4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLmludGVydmFsID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLmludGVydmFsICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMuaW50ZXJ2YWwgKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgaW50cnY6IG51bWJlciA9IDE7XHJcblxyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5pbnRlcnZhbCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdFx0aW50cnYgPSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5pbnRlcnZhbCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGludHJ2ID0gdGhpcy5pbnRlcnZhbDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKHJlczogKHZhbHVlOiBib29sZWFuKSA9PiB2b2lkLCByZWo/OiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4gc2V0VGltZW91dChyZXMsIGludHJ2KSkuYmluZCh0aGlzKSk7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL1NscFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBMYWJlbCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmc7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCAhPT0gMSkgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgTXVzdCBmb2xsb3cgdGhlIGZvcm1hdCAnbGFiZWwke2NvbmZpZy5qbXBsYWJ9Jy4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wYXJhbXNbMF07XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0xhYmVsXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIEptcCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCB0bzogc3RyaW5nIHwgbnVtYmVyO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgbGFiZWwuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy50byA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy50byAqIDEpID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHR0aGlzLnRvICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLnRvID09PSBcInN0cmluZ1wiKSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy50by5lbmRzV2l0aChjb25maWcuam1wbGFiKSkge1xyXG5cdFx0XHRcdFx0XHRsZXQgdG1wOiBudW1iZXIgPSB0aGlzLnBhcmVudC5pbnN0cnVjdGlvbnMuZmluZEluZGV4KChpbnM6IEluc3RydWN0aW9uKTogYm9vbGVhbiA9PiAoaW5zIGluc3RhbmNlb2YgTGFiZWwpICYmIGlucy5uYW1lID09PSB0aGlzLnRvKTsgIC8vZmlyc3QtdGltZS1pbml0aWFsaXphdGlvbiBoYXBwZW5zIHVwb24gZXhlY3V0aW9uIHRvIGVuc3VyZSBsYWJlbHMgYWxsIGV4aXN0XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodG1wIDwgMCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgTGFiZWwgJHt0aGlzLnRvfSBkb2VzIG5vdCBleGlzdC5gKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImptYlwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy50byA9IHRtcCk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRsZXQgbGFiOiBzdHJpbmcgPSB0aGlzLnBhcmVudC5yZWdpc3RlcnMuaGFzKDxzdHJpbmc+PHVua25vd24+dGhpcy50bykgPyB0aGlzLnBhcmVudC5nZXRSZWcoPHN0cmluZz48dW5rbm93bj50aGlzLnRvKSA6IChjb25maWcuc3RhcnRzbWJsICsgY29uZmlnLmptcGxhYiksXHJcblx0XHRcdFx0XHRcdFx0dG1wOiBudW1iZXIgPSB0aGlzLnBhcmVudC5pbnN0cnVjdGlvbnMuZmluZEluZGV4KChpbnM6IEluc3RydWN0aW9uKTogYm9vbGVhbiA9PiAoaW5zIGluc3RhbmNlb2YgTGFiZWwpICYmIGlucy5uYW1lID09PSBsYWIpO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKHRtcCA8IDApIHRocm93cyhKU0FFcnJvcnMuRUJBREpNUCwgYExhYmVsICR7dGhpcy50b30gZG9lcyBub3QgZXhpc3QuYCk7XHJcblxyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbWJcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRtcCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnRvIDwgMCB8fCB0aGlzLnRvID49IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5sZW5ndGgpIHRocm93cyhKU0FFcnJvcnMuRUJBREpNUCwgYEludmFsaWQganVtcCB0byAke3RoaXMudG99YCk7XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam1iXCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSk7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy50byk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0ptcFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBJZiBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgZXE6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGZyb206IHN0cmluZyA9IFwiYWNjXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nIHwgbnVtYmVyID0gMDtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMiwgdGhlIGFkZHJlc3MgYW5kIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zWzBdLmVuZHNXaXRoKCdlJykpIHtcclxuXHRcdFx0XHRcdHRoaXMuZXEgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPT09IDMpIHtcclxuXHRcdFx0XHRcdHRoaXMuZnJvbSA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHRcdFx0XHRcdHRoaXMudG8gPSB0aGlzLl9wYXJhbXNbMl07XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMudG8gPSB0aGlzLl9wYXJhbXNbMV07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLnRvKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy50byAqPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy50byA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMuZXEpIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pICE9IHRoaXMudG8pIHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikgKyAxKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSA8IHRoaXMudG8pIHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikgKyAxKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMuZXEpIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pID09IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSkgdGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSArIDEpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pIDwgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0lmXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIFBydCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBkZWZhdWx0OiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGxldCBwcmVjOiBzdHJpbmdbXSA9IHRoaXMuX3BhcmFtcy5zbGljZSgxKTtcclxuXHJcblx0XHRcdFx0aWYgKHByZWMubGVuZ3RoKSB7XHJcblx0XHRcdFx0XHRmb3IgKGxldCBwYXJhbSBvZiBwcmVjKSB7XHJcblx0XHRcdFx0XHRcdGlmIChjb25maWcuc3RyLnRlc3QocGFyYW0pKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMub3V0cHV0LndyaXRlKHBhcmFtLnJlcGxhY2UoY29uZmlnLnN0ciwgXCIkMVwiKSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMub3V0cHV0LndyaXRlKHRoaXMucGFyZW50LmdldFJlZyhwYXJhbSkgKyAnJyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMub3V0cHV0LndyaXRlKHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmRlZmF1bHQpICsgJycpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9QcnRcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgSW5wIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggIT09IDEpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBleGFjdGx5IDAuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLmlucHV0Lm9uY2UoXCJyZWFkYWJsZVwiLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5fc3RyZWFtcy5pbnB1dC5yZWFkKDEpKTtcclxuXHRcdFx0XHRcdFx0cmVzKGZhbHNlKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9JbnBcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTWV0aG9kIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cdFx0XHQvL2NyZWF0ZXMgc2NvcGVzIGFuZCBjYWxscyBvbmx5IVxyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgYXJnczogc3RyaW5nID0gXCJBUkdTXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBpc0F3OiBib29sZWFuID0gZmFsc2U7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zWzBdID09PSBjb25maWcuYXcpIHtcclxuXHRcdFx0XHRcdHRoaXMuaXNBdyA9IHRydWU7XHJcblx0XHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wYXJhbXNbMV07XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMubmFtZSA9IHRoaXMuX3BhcmFtc1swXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgc2NwOiBTY29wZSB8IEZ1bmN0aW9uO1xyXG5cclxuXHRcdFx0XHRpZiAoKHNjcCA9IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm5hbWUpKSBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDEpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5fcGFyYW1zLnNsaWNlKHRoaXMuaXNBdyA/IDIgOiAxKS5mb3JFYWNoKChwYXJhbTogc3RyaW5nLCBpZHg6IG51bWJlcikgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdCg8U2NvcGU+c2NwKS5zZXRSZWcodGhpcy5hcmdzICsgYFske2lkeH1dYCwgcGFyYW0pO1xyXG5cdFx0XHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLmlzQXcpIHtcclxuXHRcdFx0XHRcdFx0XHRhd2FpdCBzY3AuY2FsbCgpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHNldEltbWVkaWF0ZShzY3AuY2FsbCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCBzY3AubWFrZU9iaigpKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBzY3AgPT09IFwiZnVuY3Rpb25cIikge1xyXG5cdFx0XHRcdFx0bGV0IGRhdDogYW55O1xyXG5cclxuXHRcdFx0XHRcdGlmICh0aGlzLmlzQXcpIHtcclxuXHRcdFx0XHRcdFx0ZGF0ID0gYXdhaXQgc2NwKC4uLnRoaXMuX3BhcmFtcy5zbGljZSgyKSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRkYXQgPSBzY3AoLi4udGhpcy5fcGFyYW1zLnNsaWNlKDEpKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIGRhdCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGAke3RoaXMubmFtZX0gaXMgbm90IGEgc2NvcGUuYCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01ldGhvZFxyXG5cdFx0XHJcblx0fSAvL0luc3RydWN0aW9uc1xyXG5cclxuXHRJbnN0cnVjdGlvbi5tYXBwaW5ncyA9IG5ldyBNYXAoW1xyXG5cdFx0Wy9eYWRkKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIkFkZFwiXV0sXHJcblx0XHRbL15zdWIoIC4rKT8kLywgSW5zdHJ1Y3Rpb25zW1wiU3ViXCJdXSwgIC8vRFxyXG5cdFx0Wy9ebXVsICguKykkLywgSW5zdHJ1Y3Rpb25zW1wiTXVsXCJdXSxcclxuXHRcdFsvXmRpdiAoLispJC8sIEluc3RydWN0aW9uc1tcIkRpdlwiXV0sICAvL0RcclxuXHRcdFsvXm1vZCggLispPyQvLCBJbnN0cnVjdGlvbnNbXCJNb2RcIl1dLCAgLy9EP1xyXG5cdFx0Wy9ebW92ICguKyl7MSwyfSQvLCBJbnN0cnVjdGlvbnNbXCJNb3ZcIl1dLFxyXG5cdFx0Wy9ec2xwKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlNscFwiXV0sXHJcblx0XHRbL15qbXAgKC4rKSQvLCBJbnN0cnVjdGlvbnNbXCJKbXBcIl1dLFxyXG5cdFx0Wy9eaW5jICguKyl7MSwyfSQvLCBJbnN0cnVjdGlvbnNbXCJJbmNcIl1dLCAgLy9JTVBMXHJcblx0XHRbL15pZihlfGwpKCAuKyl7MCwyfSQvLCBJbnN0cnVjdGlvbnNbXCJJZlwiXV0sXHJcblx0XHRbL15wcnQoIC4rKT8kLywgSW5zdHJ1Y3Rpb25zW1wiUHJ0XCJdXSxcclxuXHRcdFsvXmlucCQvLCBJbnN0cnVjdGlvbnNbXCJJbnBcIl1dLFxyXG5cdFx0Wy9eKC4rKTokLywgSW5zdHJ1Y3Rpb25zW1wiTGFiZWxcIl1dLFxyXG5cdFx0Wy9eLi8sIEluc3RydWN0aW9uc1tcIk1ldGhvZFwiXV0gIC8vbWV0aG9kIGNhbGwgK1thd11cclxuXHRdKTtcclxuXHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8U2NvcGU+IHtcclxuXHRcdGlmIChleHRuYW1lKGZpbGUpID09PSAnJykgZmlsZSArPSBjb25maWcuZXh0bmFtZTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlczogKHZhbHVlOiBTY29wZSkgPT4gdm9pZCwgcmVqOiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4ge1xyXG5cdFx0XHRmcy5yZWFkRmlsZShmaWxlLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGxldCBzY3A6IFNjb3BlID0gU2NvcGUubG9hZChkYXRhLnRvU3RyaW5nKCkpO1xyXG5cdFx0XHRcdFx0c2NwLnNldFJlZyhcIl9pc01haW5fXCIsIDEpO1xyXG5cdFx0XHRcdFx0cmVzKHNjcCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0gLy9sb2FkXHJcblxyXG5cdGZ1bmN0aW9uIHRocm93cyhlcnI6IEVycm9yLCBtZXNzYWdlPzogc3RyaW5nKTogbmV2ZXIge1xyXG5cdFx0aWYgKG1lc3NhZ2UpIGVyci5tZXNzYWdlICs9IEVPTC5yZXBlYXQoMikgKyBtZXNzYWdlO1xyXG5cclxuXHRcdHRocm93IGVycjtcclxuXHR9IC8vdGhyb3dzXHJcblxyXG5cdC8vQERlY29yYXRvclxyXG5cdGZ1bmN0aW9uIGVudW1lcmFibGUodGFyZ2V0OiBPYmplY3QsIHByb3BlcnR5S2V5OiBzdHJpbmcgfCBzeW1ib2wpOiB2b2lkIHtcclxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5S2V5LCAge1xyXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcclxuXHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxyXG5cdFx0XHR3cml0YWJsZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fSAvL2VudW1lcmFibGVcclxuXHJcbn0gLy9KU0FcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEpTQTtcclxuIl19