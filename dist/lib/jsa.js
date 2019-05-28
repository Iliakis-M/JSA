"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_extra_1 = require("fs-extra");
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
        JSAErrors.EBADPTH = new ReferenceError("Bad Path.");
    })(JSAErrors = JSA.JSAErrors || (JSA.JSAErrors = {})); //JSAErrors
    class Scope extends events_1.EventEmitter {
        constructor(name) {
            super();
            this.scopes = new Map();
            this.registers = new Map([
                ["acc", 0],
                ["jmx", 0],
                ["jmb", 0],
                ["ENDL", os_1.EOL],
                ["WSPC", ' '],
                ["ARGS", []],
                ["_math", Math],
                ["_date", Date],
                ["null", null]
            ]);
            this.instructions = [];
            this.name = config.base;
            this._streams = {
                input: process.stdin,
                output: process.stdout,
                error: process.stderr
            };
            this.name = name || this.name;
            this._streams.input.setRawMode(true);
        } //ctor
        async call() {
            for (; this.registers.get("jmx") < this.instructions.length; this.registers.set("jmx", this.registers.get("jmx") + 1)) {
                if (await this.instructions[this.registers.get("jmx")].call())
                    break;
            }
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
        static load(code, name) {
            code = `${config.startsmbl}${config.jmplab}${config.endl.repeat(2)}${code}${config.endl.repeat(2)}${config.endsmbl}${config.jmplab}${config.endl}`;
            let lines = code.split(config.endl_r), subscope = -1, nscope = '', nscopename = '', scope = new Scope(name), lncnt = 0;
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
                        scope.scopes.set(nscopename, Scope.load(nscope, nscopename));
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
                if (this._params.length > 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the value.${os_1.EOL}${this._params.join(config.sep)}`);
                if (this._params[0].endsWith('e')) {
                    this.eq = true;
                }
                this.to = this._params[1] || this.to;
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
                        this.parent._streams.input.pause();
                        res(false);
                    });
                    this.parent._streams.input.resume();
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
                            setImmediate(scp.call.bind(scp));
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
        class Inc extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
                this.to = "acc";
                if (this._params.length !== 2)
                    throws(JSAErrors.EBADCAL, `Parameters must be exactly 1, the path.${os_1.EOL}${this._params.join(config.sep)}`);
                this.from = this._params[1];
            } //ctor
            async call() {
                let from = this.parent.getReg(this.from);
                if (path_1.extname(from) === '')
                    from += config.extname;
                return new Promise((res, rej) => {
                    fs_extra_1.readFile(from, (err, data) => {
                        if (err) {
                            rej(err);
                            throws(JSAErrors.EBADPTH, `${from}`);
                        }
                        else {
                            let scp = Scope.load(data.toString(), path_1.basename(from, path_1.extname(from)));
                            scp.setReg("_isMain_", 0);
                            this.parent.setReg(this.to, scp);
                            this.parent.scopes.set(scp.name, scp);
                            res(false);
                        }
                    });
                });
            } //call
        } //Inc
        Instructions.Inc = Inc;
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
        [/^if(e|l)( .+){0,2}$/, Instructions["If"]],
        [/^prt( .+)?$/, Instructions["Prt"]],
        [/^inp$/, Instructions["Inp"]],
        [/^inc (.+){1,2}$/, Instructions["Inc"]],
        [/^(.+):$/, Instructions["Label"]],
        [/^./, Instructions["Method"]]
    ]);
    async function load(file) {
        if (path_1.extname(file) === '')
            file += config.extname;
        return new Promise((res, rej) => {
            fs_extra_1.readFile(file, (err, data) => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2pzYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7OztBQUViLHVDQUFvQztBQUNwQywyQkFBeUI7QUFDekIsbUNBQXNDO0FBQ3RDLCtCQUF5QztBQUd6QyxlQUFlO0FBRWYsSUFBYyxHQUFHLENBbXZCaEI7QUFudkJELFdBQWMsR0FBRztJQUVoQixJQUFpQixNQUFNLENBdUJ0QjtJQXZCRCxXQUFpQixNQUFNO1FBQ1gsY0FBTyxHQUFXLE1BQU0sQ0FBQztRQUN6QixhQUFNLEdBQVcsR0FBRyxDQUFDO1FBQ3JCLGVBQVEsR0FBVyxHQUFHLENBQUM7UUFDdkIsZ0JBQVMsR0FBVyxVQUFVLENBQUM7UUFDL0IsY0FBTyxHQUFXLFFBQVEsQ0FBQztRQUMzQixXQUFJLEdBQVcsVUFBVSxDQUFDO1FBQzFCLFVBQUcsR0FBVyxLQUFLLENBQUM7UUFDcEIsU0FBRSxHQUFXLElBQUksQ0FBQztRQUNsQixTQUFFLEdBQVcsS0FBSyxDQUFDO1FBQ25CLGlCQUFVLEdBQVcsS0FBSyxDQUFDO1FBQzNCLFVBQUcsR0FBVyxHQUFHLENBQUM7UUFDbEIsV0FBSSxHQUFXLFFBQUcsQ0FBQztRQUNuQixZQUFLLEdBQVcsWUFBWSxDQUFDO1FBQzdCLGFBQU0sR0FBVyxhQUFhLENBQUM7UUFFMUMsa0JBQWtCO1FBQ1AsY0FBTyxHQUFXLElBQUksTUFBTSxDQUFDLElBQUksR0FBRyxPQUFBLEdBQUcsR0FBRyxNQUFNLEdBQUcsT0FBQSxFQUFFLEdBQUcsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ25FLGNBQU8sR0FBVyxRQUFRLENBQUE7UUFDMUIsWUFBSyxHQUFXLHFCQUFxQixDQUFDO1FBQ3RDLFVBQUcsR0FBVyxrQkFBa0IsQ0FBQztRQUNqQyxXQUFJLEdBQVcsV0FBVyxDQUFDO1FBQzNCLFdBQUksR0FBVyxhQUFhLENBQUE7SUFDeEMsQ0FBQyxFQXZCZ0IsTUFBTSxH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b3J0IHsgcmVhZEZpbGUgfSBmcm9tIFwiZnMtZXh0cmFcIjtcclxuaW1wb3J0IHsgRU9MIH0gZnJvbSBcIm9zXCI7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcclxuaW1wb3J0IHsgZXh0bmFtZSwgYmFzZW5hbWUgfSBmcm9tIFwicGF0aFwiO1xyXG5cclxuXHJcbi8vSU1QTDogb2JqZWN0c1xyXG5cclxuZXhwb3J0IG1vZHVsZSBKU0Ege1xyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIGNvbmZpZyB7XHJcblx0XHRleHBvcnQgdmFyIGV4dG5hbWU6IHN0cmluZyA9IFwiLmpzYVwiO1xyXG5cdFx0ZXhwb3J0IHZhciBqbXBsYWI6IHN0cmluZyA9ICc6JztcclxuXHRcdGV4cG9ydCB2YXIgYXJyYXlzZXA6IHN0cmluZyA9ICcsJztcclxuXHRcdGV4cG9ydCB2YXIgc3RhcnRzbWJsOiBzdHJpbmcgPSBcIl9fU1RBUlRfXCI7XHJcblx0XHRleHBvcnQgdmFyIGVuZHNtYmw6IHN0cmluZyA9IFwiX19FTkRfXCI7XHJcblx0XHRleHBvcnQgdmFyIGJhc2U6IHN0cmluZyA9IFwiX19CQVNFX19cIjtcclxuXHRcdGV4cG9ydCB2YXIgYXNuOiBzdHJpbmcgPSBcImFzblwiO1xyXG5cdFx0ZXhwb3J0IHZhciBhdzogc3RyaW5nID0gXCJhd1wiO1xyXG5cdFx0ZXhwb3J0IHZhciBmbjogc3RyaW5nID0gXCJkZWZcIjtcclxuXHRcdGV4cG9ydCB2YXIgaXNTY29wZUVuZDogc3RyaW5nID0gXCJlbmRcIjtcclxuXHRcdGV4cG9ydCB2YXIgc2VwOiBzdHJpbmcgPSAnICc7XHJcblx0XHRleHBvcnQgdmFyIGVuZGw6IHN0cmluZyA9IEVPTDtcclxuXHRcdGV4cG9ydCB2YXIgc2VwX3I6IFJlZ0V4cCA9IC8oPzwhXFxcXCkgL2dtO1xyXG5cdFx0ZXhwb3J0IHZhciBlbmRsX3I6IFJlZ0V4cCA9IC8oPzwhXFxcXClcXG4vZ207XHJcblxyXG5cdFx0Ly9TRUNPTkQgRVhQQU5TSU9OXHJcblx0XHRleHBvcnQgdmFyIGlzU2NvcGU6IFJlZ0V4cCA9IG5ldyBSZWdFeHAoXCJeKFwiICsgYXNuICsgXCIgKT8oXCIgKyBmbiArIFwiKSA/XCIsICcnKTtcclxuXHRcdGV4cG9ydCB2YXIgY29tbWVudDogUmVnRXhwID0gLyMuKiQvaXNcclxuXHRcdGV4cG9ydCB2YXIgaW5kZXg6IFJlZ0V4cCA9IC9cXFsoLispXFxdfFxcKCguKylcXCkvbXM7XHJcblx0XHRleHBvcnQgdmFyIHN0cjogUmVnRXhwID0gL15bJ1wiXSguKylbJ1wiXSQvbXM7XHJcblx0XHRleHBvcnQgdmFyIHByb3A6IFJlZ0V4cCA9IC9cXC4oLispJC9tcztcclxuXHRcdGV4cG9ydCB2YXIgZXNjczogUmVnRXhwID0gLyg/PCFcXFxcKVxcXFwvZ21cclxuXHR9IC8vY29uZmlnXHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgSlNBRXJyb3JzIHtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFETjogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgTmFtZS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRFM6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIFNjb3BlLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEQ0FMOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBwYXJhbWV0ZXJzLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEU1lOOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBTeW50YXguXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVJTlNOT1RFWDogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJJbnN0cnVjdGlvbiBkb2VzIG5vdCBleGlzdC5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBREpNUDogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgSnVtcC5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRFBUSDogUmVmZXJlbmNlRXJyb3IgPSBuZXcgUmVmZXJlbmNlRXJyb3IoXCJCYWQgUGF0aC5cIik7XHJcblx0fSAvL0pTQUVycm9yc1xyXG5cclxuXHJcblx0ZXhwb3J0IGNsYXNzIFNjb3BlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0XHRyZWFkb25seSBzY29wZXM6IE1hcDxzdHJpbmcsIFNjb3BlPiA9IG5ldyBNYXA8c3RyaW5nLCBTY29wZT4oKTtcclxuXHRcdHJlYWRvbmx5IHJlZ2lzdGVyczogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KFtcclxuXHRcdFx0W1wiYWNjXCIsIDBdLFxyXG5cdFx0XHRbXCJqbXhcIiwgMF0sXHJcblx0XHRcdFtcImptYlwiLCAwXSxcclxuXHRcdFx0W1wiRU5ETFwiLCBFT0xdLFxyXG5cdFx0XHRbXCJXU1BDXCIsICcgJ10sXHJcblx0XHRcdFtcIkFSR1NcIiwgW11dLCAgLy9sb2FkIGZyb20gQ0xJP1xyXG5cdFx0XHRbXCJfbWF0aFwiLCBNYXRoXSxcclxuXHRcdFx0W1wiX2RhdGVcIiwgRGF0ZV0sXHJcblx0XHRcdFtcIm51bGxcIiwgbnVsbF1cclxuXHRcdF0pO1xyXG5cdFx0cmVhZG9ubHkgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gWyBdO1xyXG5cclxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyA9IGNvbmZpZy5iYXNlO1xyXG5cclxuXHRcdEBlbnVtZXJhYmxlXHJcblx0XHRyZWFkb25seSBfc3RyZWFtczoge1xyXG5cdFx0XHRpbnB1dDogTm9kZUpTLlJlYWRTdHJlYW0sXHJcblx0XHRcdG91dHB1dDogTm9kZUpTLldyaXRlU3RyZWFtLFxyXG5cdFx0XHRlcnJvcjogTm9kZUpTLldyaXRlU3RyZWFtXHJcblx0XHR9ID0ge1xyXG5cdFx0XHRpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuXHRcdFx0b3V0cHV0OiBwcm9jZXNzLnN0ZG91dCxcclxuXHRcdFx0ZXJyb3I6IHByb2Nlc3Muc3RkZXJyXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5hbWU/OiBzdHJpbmcpIHtcclxuXHRcdFx0c3VwZXIoKTtcclxuXHRcdFx0dGhpcy5uYW1lID0gbmFtZSB8fCB0aGlzLm5hbWU7XHJcblxyXG5cdFx0XHR0aGlzLl9zdHJlYW1zLmlucHV0LnNldFJhd01vZGUodHJ1ZSk7XHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8dm9pZD4ge1xyXG5cdFx0XHRmb3IgKDsgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpIDwgdGhpcy5pbnN0cnVjdGlvbnMubGVuZ3RoOyB0aGlzLnJlZ2lzdGVycy5zZXQoXCJqbXhcIiwgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpICsgMSkpIHtcclxuXHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5pbnN0cnVjdGlvbnNbdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpXS5jYWxsKCkpIGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdHByb3RlY3RlZCBhZGQoaW5zdDogSW5zdHJ1Y3Rpb24gfCBzdHJpbmcpOiBJbnN0cnVjdGlvbiB8IHN0cmluZyB7XHJcblx0XHRcdGlmICh0eXBlb2YgaW5zdCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdGlmIChpbnN0ID09PSAnJykgcmV0dXJuIGluc3Q7XHJcblxyXG5cdFx0XHRcdGluc3QgPSBJbnN0cnVjdGlvbi5wYXJzZShpbnN0LCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5pbnN0cnVjdGlvbnMucHVzaChpbnN0KTtcclxuXHJcblx0XHRcdHJldHVybiBpbnN0O1xyXG5cdFx0fSAvL2FkZFxyXG5cclxuXHRcdHB1YmxpYyBnZXRSZWcocmVnOiBzdHJpbmcpOiBhbnkge1xyXG5cdFx0XHRpZiAoY29uZmlnLmluZGV4LnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGlmIChyZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKSkge1xyXG5cdFx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLmluZGV4KTtcclxuXHJcblx0XHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0bGV0IHQ6IHN0cmluZyA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKTtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dCAqIDEpID09PSBmYWxzZSkgdCAqPSAxO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHQgPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdFx0bGV0IHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyk7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0eXBlb2YgdG1wW3RdID09PSBcImZ1bmN0aW9uXCIgPyB0bXBbdF0uYmluZyh0bXApIDogdG1wW3RdO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjb25maWcuc3RyLnRlc3QodCkpIHsgIC8vRD9cclxuXHRcdFx0XHRcdFx0dCA9IHQucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpOyAgLy93aHkgbm90IHVzZSAucHJvcCBzeW50YXggaW5zdGVhZD9cclxuXHRcdFx0XHRcdFx0bGV0IHJldDogYW55ID0gdGhpcy5nZXRSZWcocmVnKSxcclxuXHRcdFx0XHRcdFx0XHR0bXAgPSAocmV0IGluc3RhbmNlb2YgU2NvcGUpID8gcmV0LmdldFJlZyh0KSA6IHJldFt0XTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybiB0eXBlb2YgdG1wID09PSBcImZ1bmN0aW9uXCIgPyB0bXAuYmluZChyZXQpIDogdG1wO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bGV0IHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyksXHJcblx0XHRcdFx0XHRcdFx0XHRnb3QgPSB0bXBbdGhpcy5nZXRSZWcodCldO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuIHR5cGVvZiBnb3QgPT09IFwiZnVuY3Rpb25cIiA/IGdvdC5iaW5kKHRtcCkgOiBnb3Q7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHJldHVybiByZWcucmVwbGFjZShjb25maWcuaW5kZXgsIFwiJDFcIikuc3BsaXQoY29uZmlnLmFycmF5c2VwKS5tYXAoKGNodW5rOiBzdHJpbmcpID0+IHtcclxuXHRcdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHRcdGlmIChpc05hTig8bnVtYmVyPjx1bmtub3duPmNodW5rICogMSkgPT09IGZhbHNlKSBjaHVuayAqPSAxO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gY2h1bms7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnByb3AudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLnByb3ApO1xyXG5cclxuXHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcucHJvcCwgJycpO1xyXG5cclxuXHRcdFx0XHRsZXQgcmV0OiBhbnkgPSB0aGlzLmdldFJlZyhyZWcpO1xyXG5cclxuXHRcdFx0XHRsZXQgdDogc3RyaW5nID0gbWF0WzBdLnJlcGxhY2UoY29uZmlnLnByb3AsIFwiJDFcIiksXHJcblx0XHRcdFx0XHR0bXAgPSAocmV0IGluc3RhbmNlb2YgU2NvcGUpID8gcmV0LmdldFJlZyh0KSA6IHJldFt0XTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIHR5cGVvZiB0bXAgPT09IFwiZnVuY3Rpb25cIiA/IHRtcC5iaW5kKHJldCkgOiB0bXA7XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnN0ci50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRyZXR1cm4gcmVnLnJlcGxhY2UoY29uZmlnLnN0ciwgXCIkMVwiKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRoaXMucmVnaXN0ZXJzLmhhcyhyZWcpID8gdGhpcy5yZWdpc3RlcnMuZ2V0KHJlZykgOiAodGhpcy5zY29wZXMuaGFzKHJlZykgPyB0aGlzLnNjb3Blcy5nZXQocmVnKSA6IDApO1xyXG5cdFx0fSAvL2dldFJlZ1xyXG5cclxuXHRcdHB1YmxpYyBzZXRSZWcocmVnOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBNYXA8c3RyaW5nLCBhbnk+IHsgIC8vZm9yIGZ1bmNzP1xyXG5cdFx0XHRpZiAoY29uZmlnLmluZGV4LnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGlmIChyZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKSkge1xyXG5cdFx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLmluZGV4KTtcclxuXHRcdFx0XHRcdHJlZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgJycpO1xyXG5cclxuXHRcdFx0XHRcdGxldCB0ID0gbWF0WzBdLnJlcGxhY2UoY29uZmlnLmluZGV4LCBcIiQxXCIpLFxyXG5cdFx0XHRcdFx0XHR0bXAgPSB0aGlzLmdldFJlZyhyZWcpO1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50ICogMSkgPT09IGZhbHNlKSB0ICo9IDE7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB0ID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHRcdGlmICh0bXAgaW5zdGFuY2VvZiBTY29wZSkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0bXAuc2V0UmVnKHQsIHZhbHVlKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0bXBbdF0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRSZWcocmVnLCB0bXApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5zdHIudGVzdCh0KSkgeyAgLy9EP1xyXG5cdFx0XHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdG1wLnNldFJlZyh0LnJlcGxhY2UoY29uZmlnLnN0ciwgXCIkMVwiKSwgdmFsdWUpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRtcFt0LnJlcGxhY2UoY29uZmlnLnN0ciwgXCIkMVwiKV0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRSZWcocmVnLCB0bXApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdG1wLnNldFJlZyh0aGlzLmdldFJlZyh0KSwgdmFsdWUpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRtcFt0aGlzLmdldFJlZyh0KV0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRSZWcocmVnLCB0bXApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRocm93IEpTQUVycm9ycy5FQkFEU1lOO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChjb25maWcucHJvcC50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRsZXQgbWF0OiBzdHJpbmdbXSA9IHJlZy5tYXRjaChjb25maWcucHJvcCk7XHJcblx0XHRcdFx0cmVnID0gcmVnLnJlcGxhY2UoY29uZmlnLnByb3AsICcnKTtcclxuXHJcblx0XHRcdFx0bGV0IHQgPSBtYXRbMF0ucmVwbGFjZShjb25maWcucHJvcCwgXCIkMVwiKSxcclxuXHRcdFx0XHRcdHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyk7XHJcblxyXG5cdFx0XHRcdGlmICh0bXAgaW5zdGFuY2VvZiBTY29wZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodCwgdmFsdWUpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0bXBbdF0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFJlZyhyZWcsIHRtcCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gdGhpcy5yZWdpc3RlcnMuc2V0KHJlZywgdmFsdWUpO1xyXG5cdFx0fSAvL3NldFJlZ1xyXG5cclxuXHRcdHB1YmxpYyBtYWtlT2JqKCk6IFNjb3BlIHtcclxuXHRcdFx0bGV0IG5zY3A6IFNjb3BlID0gbmV3IFNjb3BlKCk7XHJcblxyXG5cdFx0XHRPYmplY3QuYXNzaWduKG5zY3AsIHRoaXMpO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG5zY3A7XHJcblx0XHR9IC8vbWFrZU9ialxyXG5cclxuXHRcdHB1YmxpYyBzdGF0aWMgbG9hZChjb2RlOiBzdHJpbmcsIG5hbWU/OiBzdHJpbmcpOiBTY29wZSB7ICAvL3Bhc3Mgc2NvcGUgYm9keSBhcyBzdHJpbmdcclxuXHRcdFx0Y29kZSA9IGAke2NvbmZpZy5zdGFydHNtYmx9JHtjb25maWcuam1wbGFifSR7Y29uZmlnLmVuZGwucmVwZWF0KDIpfSR7Y29kZX0ke2NvbmZpZy5lbmRsLnJlcGVhdCgyKX0ke2NvbmZpZy5lbmRzbWJsfSR7Y29uZmlnLmptcGxhYn0ke2NvbmZpZy5lbmRsfWA7XHJcblxyXG5cdFx0XHRsZXQgbGluZXMgPSBjb2RlLnNwbGl0KGNvbmZpZy5lbmRsX3IpLFxyXG5cdFx0XHRcdHN1YnNjb3BlOiBudW1iZXIgPSAtMSxcclxuXHRcdFx0XHRuc2NvcGU6IHN0cmluZyA9ICcnLFxyXG5cdFx0XHRcdG5zY29wZW5hbWU6IHN0cmluZyA9ICcnLFxyXG5cdFx0XHRcdHNjb3BlOiBTY29wZSA9IG5ldyBTY29wZShuYW1lKSxcclxuXHRcdFx0XHRsbmNudDogbnVtYmVyID0gMDtcclxuXHJcblx0XHRcdGZvciAobGV0IGxpbmUgb2YgbGluZXMpIHtcclxuXHRcdFx0XHRsaW5lID0gbGluZS5yZXBsYWNlKGNvbmZpZy5jb21tZW50LCAnJykudHJpbSgpO1xyXG5cclxuXHRcdFx0XHRpZiAoc3Vic2NvcGUgPT09IC0xICYmIGNvbmZpZy5pc1Njb3BlLnRlc3QobGluZSkpIHtcclxuXHRcdFx0XHRcdHN1YnNjb3BlKys7XHJcblxyXG5cdFx0XHRcdFx0bGV0IHBhcnRzOiBzdHJpbmdbXSA9IGxpbmUuc3BsaXQoY29uZmlnLnNlcF9yKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEU1lOLCBgVG9vIG1hbnkgcGFyYW1ldGVycyBvbiBkZWNsYXJhdGlvbiwgbmVlZCBhdCBtb3N0IDMuICgke2xuY250fSkke0VPTH0ke2xpbmV9YCk7XHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoIDwgMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEU1lOLCBgVG9vIGxpdHRsZSBwYXJhbWV0ZXJzIG9uIGRlY2xhcmF0aW9uLCBuZWVkIGF0IGxlYXN0IDIuICgke2xuY250fSkke0VPTH0ke2xpbmV9YCk7XHJcblx0XHRcdFx0XHRpZiAocGFydHMubGVuZ3RoID09PSAzICYmIGNvbmZpZy5hc24gIT09IHBhcnRzWzBdKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTWU4sIGBGaXJzdCBwYXJhbWV0ZXIgbXVzdCBiZSAnYXNuJywgc2Vjb25kICdkZWYnIGFuZCB0aGlyZCB0aGUgbmFtZS4gKCR7bG5jbnR9KSR7RU9MfSR7bGluZX1gKTtcclxuXHRcdFx0XHRcdGlmIChjb25maWcuaXNTY29wZS50ZXN0KG5zY29wZW5hbWUgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSkpIHRocm93cyhKU0FFcnJvcnMuRUJBRE4pO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoc3Vic2NvcGUgPiAtMSAmJiBjb25maWcuaXNTY29wZUVuZCAhPT0gbGluZSkge1xyXG5cdFx0XHRcdFx0bnNjb3BlICs9IGxpbmUgKyBjb25maWcuZW5kbDtcclxuXHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGUudGVzdChsaW5lKSkgc3Vic2NvcGUrKztcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlID4gLTEpIHtcclxuXHRcdFx0XHRcdGlmICgtLXN1YnNjb3BlID09PSAtMSkge1xyXG5cdFx0XHRcdFx0XHRzY29wZS5zY29wZXMuc2V0KG5zY29wZW5hbWUsIFNjb3BlLmxvYWQobnNjb3BlLCBuc2NvcGVuYW1lKSk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlIDwgLTEpIHtcclxuXHRcdFx0XHRcdFx0dGhyb3dzKEpTQUVycm9ycy5FQkFEUywgbGluZSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRuc2NvcGUgKz0gbGluZSArIGNvbmZpZy5lbmRsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGVFbmQgPT09IGxpbmUpIHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGxpbmUpO1xyXG5cclxuXHRcdFx0XHRcdHNjb3BlLmFkZChsaW5lKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxuY250Kys7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChzdWJzY29wZSAhPT0gLTEpIHRocm93cyhKU0FFcnJvcnMuRUJBRFMpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNjb3BlO1xyXG5cdFx0fSAvL2xvYWRcclxuXHJcblx0fSAvL1Njb3BlXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBJbnN0cnVjdGlvbiB7XHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3BhcmFtczogc3RyaW5nW107XHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBtYXBwaW5nczogTWFwPFJlZ0V4cCwgdHlwZW9mIEluc3RydWN0aW9uPjtcclxuXHJcblx0XHRwcm90ZWN0ZWQgY29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwcm90ZWN0ZWQgcmVhZG9ubHkgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHR0aGlzLl9wYXJhbXMgPSBpbnN0LnNwbGl0KGNvbmZpZy5zZXBfcikubWFwKHBhcnQgPT4gcGFydC5yZXBsYWNlKGNvbmZpZy5lc2NzLCAnJykpO1xyXG5cdFx0fSAvL2N0b3JcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIHBhcnNlKGxpbmU6IHN0cmluZywgcGFyZW50OiBTY29wZSk6IEluc3RydWN0aW9uIHtcclxuXHRcdFx0bGV0IGluczogW1JlZ0V4cCwgdHlwZW9mIEluc3RydWN0aW9uXTtcclxuXHJcblx0XHRcdGlmICgoaW5zID0gQXJyYXkuZnJvbShJbnN0cnVjdGlvbi5tYXBwaW5ncy5lbnRyaWVzKCkpLmZpbmQoKGFycik6IGJvb2xlYW4gPT4gYXJyWzBdLnRlc3QobGluZSkpKSAmJiBpbnNbMV0pIHtcclxuXHRcdFx0XHRyZXR1cm4gbmV3IChpbnNbMV0pKGxpbmUsIHBhcmVudCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBJbnN0cnVjdGlvbihsaW5lLCBwYXJlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9IC8vcGFyc2VcclxuXHJcblx0XHQvL0BPdmVycmlkZVxyXG5cdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdHJldHVybiB0aHJvd3MoSlNBRXJyb3JzLkVJTlNOT1RFWCwgYCR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHR9IC8vSW5zdHJ1Y3Rpb25cclxuXHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgSW5zdHJ1Y3Rpb25zIHtcclxuXHRcdGV4cG9ydCBjbGFzcyBBZGQgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBudW06IG51bWJlciB8IHN0cmluZyA9IDE7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBtb3N0IDEsIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLm51bSA9IHRoaXMuX3BhcmFtc1sxXSB8fCB0aGlzLm51bTtcclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLm51bSAqIDEpID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHR0aGlzLm51bSAqPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKyB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKyB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vQWRkXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIFN1YiBleHRlbmRzIEFkZCB7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAtIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAtIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9TdWJcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTXVsIGV4dGVuZHMgQWRkIHtcclxuXHJcblx0XHRcdC8vQE92ZXJyaWRlXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBudW06IG51bWJlciB8IHN0cmluZyA9IDI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAqIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAqIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9NdWxcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgRGl2IGV4dGVuZHMgTXVsIHtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pIC8gdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pIC8gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0RpdlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNb2QgZXh0ZW5kcyBEaXYge1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgJSB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgJSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTW9kXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIE1vdiBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBmcm9tOiBudW1iZXIgfCBzdHJpbmcgfCBBcnJheTxhbnk+ID0gMDtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPCAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbGVhc3QgMSwgdGhlIHZhbHVlLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAzKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAyLCB0aGUgYWRkcmVzcyBhbmQgdGhlIHZhbHVlLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID09PSAzKSB7XHJcblx0XHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzJdO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLmZyb20gPSB0aGlzLl9wYXJhbXNbMV07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLmZyb20gKiAxKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy5mcm9tICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLmZyb20gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLmZyb20pO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuZnJvbSA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTW92XHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIFNscCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBpbnRlcnZhbDogbnVtYmVyIHwgc3RyaW5nID0gMTtcclxuXHRcdFx0XHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMSwgdGhlIGludGVydmFsLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdHRoaXMuaW50ZXJ2YWwgPSB0aGlzLl9wYXJhbXNbMV07XHJcblxyXG5cdFx0XHRcdGlmIChpc05hTig8bnVtYmVyPjx1bmtub3duPnRoaXMuaW50ZXJ2YWwgKiAxKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy5pbnRlcnZhbCAqPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGxldCBpbnRydjogbnVtYmVyID0gMTtcclxuXHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLmludGVydmFsID09PSBcInN0cmluZ1wiKSB7XHJcblx0XHRcdFx0XHRpbnRydiA9IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmludGVydmFsKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aW50cnYgPSB0aGlzLmludGVydmFsO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgocmVzOiAodmFsdWU6IGJvb2xlYW4pID0+IHZvaWQsIHJlaj86IChlcnI6IEVycm9yKSA9PiB2b2lkKSA9PiBzZXRUaW1lb3V0KHJlcywgaW50cnYpKS5iaW5kKHRoaXMpKTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vU2xwXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIExhYmVsIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoICE9PSAxKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBNdXN0IGZvbGxvdyB0aGUgZm9ybWF0ICdsYWJlbCR7Y29uZmlnLmptcGxhYn0nLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdHRoaXMubmFtZSA9IHRoaXMuX3BhcmFtc1swXTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTGFiZWxcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgSm1wIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHRvOiBzdHJpbmcgfCBudW1iZXI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBtb3N0IDEsIHRoZSBsYWJlbC4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLnRvICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMudG8gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMudG8gPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnRvLmVuZHNXaXRoKGNvbmZpZy5qbXBsYWIpKSB7XHJcblx0XHRcdFx0XHRcdGxldCB0bXA6IG51bWJlciA9IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5maW5kSW5kZXgoKGluczogSW5zdHJ1Y3Rpb24pOiBib29sZWFuID0+IChpbnMgaW5zdGFuY2VvZiBMYWJlbCkgJiYgaW5zLm5hbWUgPT09IHRoaXMudG8pOyAgLy9maXJzdC10aW1lLWluaXRpYWxpemF0aW9uIGhhcHBlbnMgdXBvbiBleGVjdXRpb24gdG8gZW5zdXJlIGxhYmVscyBhbGwgZXhpc3RcclxuXHJcblx0XHRcdFx0XHRcdGlmICh0bXAgPCAwKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURKTVAsIGBMYWJlbCAke3RoaXMudG99IGRvZXMgbm90IGV4aXN0LmApO1xyXG5cclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam1iXCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSk7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnRvID0gdG1wKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGxldCBsYWI6IHN0cmluZyA9IHRoaXMucGFyZW50LnJlZ2lzdGVycy5oYXMoPHN0cmluZz48dW5rbm93bj50aGlzLnRvKSA/IHRoaXMucGFyZW50LmdldFJlZyg8c3RyaW5nPjx1bmtub3duPnRoaXMudG8pIDogKGNvbmZpZy5zdGFydHNtYmwgKyBjb25maWcuam1wbGFiKSxcclxuXHRcdFx0XHRcdFx0XHR0bXA6IG51bWJlciA9IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5maW5kSW5kZXgoKGluczogSW5zdHJ1Y3Rpb24pOiBib29sZWFuID0+IChpbnMgaW5zdGFuY2VvZiBMYWJlbCkgJiYgaW5zLm5hbWUgPT09IGxhYik7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodG1wIDwgMCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgTGFiZWwgJHt0aGlzLnRvfSBkb2VzIG5vdCBleGlzdC5gKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImptYlwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdG1wKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMudG8gPCAwIHx8IHRoaXMudG8gPj0gdGhpcy5wYXJlbnQuaW5zdHJ1Y3Rpb25zLmxlbmd0aCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgSW52YWxpZCBqdW1wIHRvICR7dGhpcy50b31gKTtcclxuXHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbWJcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpKTtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnRvKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSm1wXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIElmIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBlcTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZnJvbTogc3RyaW5nID0gXCJhY2NcIjtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgfCBudW1iZXIgPSAwO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgdmFsdWUuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtc1swXS5lbmRzV2l0aCgnZScpKSB7XHJcblx0XHRcdFx0XHR0aGlzLmVxID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRoaXMudG8gPSB0aGlzLl9wYXJhbXNbMV0gfHwgdGhpcy50bztcclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy50bykgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMudG8gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMudG8gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLmVxKSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSAhPSB0aGlzLnRvKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZnJvbSkgPCB0aGlzLnRvKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLmVxKSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSA9PSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykpIHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikgKyAxKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSA8IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSkgdGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSArIDEpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9JZlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBQcnQgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZGVmYXVsdDogc3RyaW5nID0gXCJhY2NcIjtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgcHJlYzogc3RyaW5nW10gPSB0aGlzLl9wYXJhbXMuc2xpY2UoMSk7XHJcblxyXG5cdFx0XHRcdGlmIChwcmVjLmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0Zm9yIChsZXQgcGFyYW0gb2YgcHJlYykge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29uZmlnLnN0ci50ZXN0KHBhcmFtKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLm91dHB1dC53cml0ZShwYXJhbS5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIikpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLm91dHB1dC53cml0ZSh0aGlzLnBhcmVudC5nZXRSZWcocGFyYW0pICsgJycpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLm91dHB1dC53cml0ZSh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5kZWZhdWx0KSArICcnKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vUHJ0XHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIElucCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nID0gXCJhY2NcIjtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoICE9PSAxKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgZXhhY3RseSAwLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5pbnB1dC5vbmNlKFwicmVhZGFibGVcIiwgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuX3N0cmVhbXMuaW5wdXQucmVhZCgxKSk7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLmlucHV0LnBhdXNlKCk7XHJcblx0XHRcdFx0XHRcdHJlcyhmYWxzZSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMuaW5wdXQucmVzdW1lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0lucFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNZXRob2QgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblx0XHRcdC8vY3JlYXRlcyBzY29wZXMgYW5kIGNhbGxzIG9ubHkhXHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBhcmdzOiBzdHJpbmcgPSBcIkFSR1NcIjtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGlzQXc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXNbMF0gPT09IGNvbmZpZy5hdykge1xyXG5cdFx0XHRcdFx0dGhpcy5pc0F3ID0gdHJ1ZTtcclxuXHRcdFx0XHRcdHRoaXMubmFtZSA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5uYW1lID0gdGhpcy5fcGFyYW1zWzBdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGxldCBzY3A6IFNjb3BlIHwgRnVuY3Rpb247XHJcblxyXG5cdFx0XHRcdGlmICgoc2NwID0gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubmFtZSkpIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLl9wYXJhbXMuc2xpY2UodGhpcy5pc0F3ID8gMiA6IDEpLmZvckVhY2goKHBhcmFtOiBzdHJpbmcsIGlkeDogbnVtYmVyKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0KDxTY29wZT5zY3ApLnNldFJlZyh0aGlzLmFyZ3MgKyBgWyR7aWR4fV1gLCBwYXJhbSk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuaXNBdykge1xyXG5cdFx0XHRcdFx0XHRcdGF3YWl0IHNjcC5jYWxsKCk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0c2V0SW1tZWRpYXRlKHNjcC5jYWxsLmJpbmQoc2NwKSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCBzY3AubWFrZU9iaigpKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBzY3AgPT09IFwiZnVuY3Rpb25cIikge1xyXG5cdFx0XHRcdFx0bGV0IGRhdDogYW55O1xyXG5cclxuXHRcdFx0XHRcdGlmICh0aGlzLmlzQXcpIHtcclxuXHRcdFx0XHRcdFx0ZGF0ID0gYXdhaXQgc2NwKC4uLnRoaXMuX3BhcmFtcy5zbGljZSgyKSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRkYXQgPSBzY3AoLi4udGhpcy5fcGFyYW1zLnNsaWNlKDEpKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIGRhdCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGAke3RoaXMubmFtZX0gaXMgbm90IGEgc2NvcGUuYCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01ldGhvZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBJbmMgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgZnJvbTogc3RyaW5nO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCAhPT0gMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGV4YWN0bHkgMSwgdGhlIHBhdGguJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0bGV0IGZyb206IHN0cmluZyA9IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pO1xyXG5cdFx0XHRcdGlmIChleHRuYW1lKGZyb20pID09PSAnJykgZnJvbSArPSBjb25maWcuZXh0bmFtZTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXM6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZCwgcmVqOiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4ge1xyXG5cdFx0XHRcdFx0cmVhZEZpbGUoZnJvbSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0XHRcdFx0dGhyb3dzKEpTQUVycm9ycy5FQkFEUFRILCBgJHtmcm9tfWApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGxldCBzY3A6IFNjb3BlID0gU2NvcGUubG9hZChkYXRhLnRvU3RyaW5nKCksIGJhc2VuYW1lKGZyb20sIGV4dG5hbWUoZnJvbSkpKTtcclxuXHRcdFx0XHRcdFx0XHRzY3Auc2V0UmVnKFwiX2lzTWFpbl9cIiwgMCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHNjcCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2NvcGVzLnNldChzY3AubmFtZSwgc2NwKTtcclxuXHRcdFx0XHRcdFx0XHRyZXMoZmFsc2UpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSW5jXHJcblx0XHRcclxuXHR9IC8vSW5zdHJ1Y3Rpb25zXHJcblxyXG5cdEluc3RydWN0aW9uLm1hcHBpbmdzID0gbmV3IE1hcDxSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbj4oW1xyXG5cdFx0Wy9eYWRkKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIkFkZFwiXV0sXHJcblx0XHRbL15zdWIoIC4rKT8kLywgSW5zdHJ1Y3Rpb25zW1wiU3ViXCJdXSwgIC8vRFxyXG5cdFx0Wy9ebXVsICguKykkLywgSW5zdHJ1Y3Rpb25zW1wiTXVsXCJdXSxcclxuXHRcdFsvXmRpdiAoLispJC8sIEluc3RydWN0aW9uc1tcIkRpdlwiXV0sICAvL0RcclxuXHRcdFsvXm1vZCggLispPyQvLCBJbnN0cnVjdGlvbnNbXCJNb2RcIl1dLCAgLy9EP1xyXG5cdFx0Wy9ebW92ICguKyl7MSwyfSQvLCBJbnN0cnVjdGlvbnNbXCJNb3ZcIl1dLFxyXG5cdFx0Wy9ec2xwKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlNscFwiXV0sXHJcblx0XHRbL15qbXAgKC4rKSQvLCBJbnN0cnVjdGlvbnNbXCJKbXBcIl1dLFxyXG5cdFx0Wy9eaWYoZXxsKSggLispezAsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSWZcIl1dLFxyXG5cdFx0Wy9ecHJ0KCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlBydFwiXV0sXHJcblx0XHRbL15pbnAkLywgSW5zdHJ1Y3Rpb25zW1wiSW5wXCJdXSxcclxuXHRcdFsvXmluYyAoLispezEsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSW5jXCJdXSwgIC8vSU1QTFxyXG5cdFx0Wy9eKC4rKTokLywgSW5zdHJ1Y3Rpb25zW1wiTGFiZWxcIl1dLFxyXG5cdFx0Wy9eLi8sIEluc3RydWN0aW9uc1tcIk1ldGhvZFwiXV1cclxuXHRdKTtcclxuXHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8U2NvcGU+IHtcclxuXHRcdGlmIChleHRuYW1lKGZpbGUpID09PSAnJykgZmlsZSArPSBjb25maWcuZXh0bmFtZTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlczogKHZhbHVlOiBTY29wZSkgPT4gdm9pZCwgcmVqOiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4ge1xyXG5cdFx0XHRyZWFkRmlsZShmaWxlLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGxldCBzY3A6IFNjb3BlID0gU2NvcGUubG9hZChkYXRhLnRvU3RyaW5nKCkpO1xyXG5cdFx0XHRcdFx0c2NwLnNldFJlZyhcIl9pc01haW5fXCIsIDEpO1xyXG5cdFx0XHRcdFx0cmVzKHNjcCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0gLy9sb2FkXHJcblxyXG5cdGZ1bmN0aW9uIHRocm93cyhlcnI6IEVycm9yLCBtZXNzYWdlPzogc3RyaW5nKTogbmV2ZXIge1xyXG5cdFx0aWYgKG1lc3NhZ2UpIGVyci5tZXNzYWdlICs9IEVPTC5yZXBlYXQoMikgKyBtZXNzYWdlO1xyXG5cclxuXHRcdHRocm93IGVycjtcclxuXHR9IC8vdGhyb3dzXHJcblxyXG5cdC8vQERlY29yYXRvclxyXG5cdGZ1bmN0aW9uIGVudW1lcmFibGUodGFyZ2V0OiBPYmplY3QsIHByb3BlcnR5S2V5OiBzdHJpbmcgfCBzeW1ib2wpOiB2b2lkIHtcclxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5S2V5LCAge1xyXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcclxuXHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxyXG5cdFx0XHR3cml0YWJsZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fSAvL2VudW1lcmFibGVcclxuXHJcbn0gLy9KU0FcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEpTQTtcclxuIl19