"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_extra_1 = require("fs-extra");
const os_1 = require("os");
const events_1 = require("events");
const path_1 = require("path");
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
        config.index = /\[(.+)?\]|\((.+)?\)/ms;
        config.str = /^['"](.+)?['"]$/ms;
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
                ["null", null],
                ["_process", process],
                ["_require", require]
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
            if (typeof reg === "number") {
                return reg;
            }
            else if (config.index.test(reg)) {
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
                else { //ARRAYS HERE
                    let tmp = reg.replace(config.index, "$1");
                    if (!tmp)
                        return [];
                    return tmp.split(config.arraysep).map((chunk) => {
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
                let reg = this.parent.getReg(this.to);
                if (typeof this.num === "number") {
                    this.parent.setReg(this.to, reg + this.num);
                }
                else {
                    if (reg instanceof Array) {
                        reg.push(this.parent.getReg(this.num));
                    }
                    else {
                        this.parent.setReg(this.to, reg + this.parent.getReg(this.num));
                    }
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
                        if (this.parent.getReg(this.from) != this.parent.getReg(this.to))
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
                        dat = await scp(...this._params.slice(2).map((param) => this.parent.getReg(param)));
                    }
                    else {
                        dat = scp(...this._params.slice(1).map((param) => this.parent.getReg(param)));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2pzYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7OztBQUViLHVDQUFvQztBQUNwQywyQkFBeUI7QUFDekIsbUNBQXNDO0FBQ3RDLCtCQUF5QztBQUd6QyxJQUFjLEdBQUcsQ0Frd0JoQjtBQWx3QkQsV0FBYyxHQUFHO0lBRWhCLElBQWlCLE1BQU0sQ0F1QnRCO0lBdkJELFdBQWlCLE1BQU07UUFDWCxjQUFPLEdBQVcsTUFBTSxDQUFDO1FBQ3pCLGFBQU0sR0FBVyxHQUFHLENBQUM7UUFDckIsZUFBUSxHQUFXLEdBQUcsQ0FBQztRQUN2QixnQkFBUyxHQUFXLFVBQVUsQ0FBQztRQUMvQixjQUFPLEdBQVcsUUFBUSxDQUFDO1FBQzNCLFdBQUksR0FBVyxVQUFVLENBQUM7UUFDMUIsVUFBRyxHQUFXLEtBQUssQ0FBQztRQUNwQixTQUFFLEdBQVcsSUFBSSxDQUFDO1FBQ2xCLFNBQUUsR0FBVyxLQUFLLENBQUM7UUFDbkIsaUJBQVUsR0FBVyxLQUFLLENBQUM7UUFDM0IsVUFBRyxHQUFXLEdBQUcsQ0FBQztRQUNsQixXQUFJLEdBQVcsUUFBRyxDQUFDO1FBQ25CLFlBQUssR0FBVyxZQUFZLENBQUM7UUFDN0IsYUFBTSxHQUFXLGFBQWEsQ0FBQztRQUUxQyxrQkFBa0I7UUFDUCxjQUFPLEdBQVcsSUFBSSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQUEsR0FBRyxHQUFHLE1BQU0sR0FBRyxPQUFBLEVBQUUsR0FBRyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbkUsY0FBTyxHQUFXLFFBQVEsQ0FBQTtRQUMxQixZQUFLLEdBQVcsdUJBQXVCLENBQUM7UUFDeEMsVUFBRyxHQUFXLG1CQUFtQixDQUFDO1FBQ2xDLFdBQUksR0FBVyxXQUFXLENBQUM7UUFDM0IsV0FBSSxHQUFXLGFBQWEsQ0FBQTtJQUN4QyxDQUFDLEVBdkJnQixNQUFNLEdBQU4sVUFBTSxLQUFOLFVBQU0sUUF1QnRCLENBQUMsUUFBUTtJQUVWLElBQWlCLFNBQVMsQ0FRekI7SUFSRCxXQUFpQixTQUFTO1FBQ1osZUFBSyxHQUFnQixJQUFJLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNsRCxlQUFLLEdBQWdCLElBQUksV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ25ELGlCQUFPLEdBQWdCLElBQUksV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDMUQsaUJBQU8sR0FBZ0IsSUFBSSxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEQsbUJBQVMsR0FBZ0IsSUFBSSxXQUFXLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUN4RSxpQkFBTyxHQUFnQixJQUFJLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRCxpQkFBTyxHQUFtQixJQUFJLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN4RSxDQUFDLEVBUmdCLFNBQVMsR0FBVCxhQUFTLEtBQVQsYUFBUyxRQVF6QixDQUFDLFdBQVc7SUFHYixNQUFhLEtBQU0sU0FBUSxxQkFBWTtRQStCdEMsWUFBWSxJQUFhO1lBQ3hCLEtBQUssRUFBRSxDQUFDO1lBOUJBLFdBQU0sR0FBdUIsSUFBSSxHQUFHLEVBQWlCLENBQUM7WUFDdEQsY0FBUyxHQUFxQixJQUFJLEdBQUcsQ0FBYztnQkFDM0QsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUNWLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDVixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Z0JBQ1YsQ0FBQyxNQUFNLEVBQUUsUUFBRyxDQUFDO2dCQUNiLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQztnQkFDYixDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Z0JBQ1osQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDO2dCQUNmLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQztnQkFDZixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7Z0JBQ2QsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDO2dCQUNyQixDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUM7YUFDckIsQ0FBQyxDQUFDO1lBQ00saUJBQVksR0FBa0IsRUFBRyxDQUFDO1lBRWxDLFNBQUksR0FBVyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBRzNCLGFBQVEsR0FJYjtnQkFDSCxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7Z0JBQ3BCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtnQkFDdEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNO2FBQ3JCLENBQUM7WUFJRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDO1lBRTlCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxDQUFDLENBQUMsTUFBTTtRQUVELEtBQUssQ0FBQyxJQUFJO1lBQ2hCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO2dCQUN0SCxJQUFJLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRTtvQkFBRSxNQUFNO2FBQ3JFO1FBQ0YsQ0FBQyxDQUFDLE1BQU07UUFFRSxHQUFHLENBQUMsSUFBMEI7WUFDdkMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQzdCLElBQUksSUFBSSxLQUFLLEVBQUU7b0JBQUUsT0FBTyxJQUFJLENBQUM7Z0JBRTdCLElBQUksR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNyQztZQUVELElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTdCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQyxDQUFDLEtBQUs7UUFFQSxNQUFNLENBQUMsR0FBb0I7WUFDakMsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUU7Z0JBQzVCLE9BQU8sR0FBRyxDQUFDO2FBQ1g7aUJBQU0sSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDbEMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUU7b0JBQ2xDLElBQUksR0FBRyxHQUFhLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUU1QyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUVwQyxJQUFJLENBQUMsR0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ25ELFlBQVk7b0JBQ1osSUFBSSxLQUFLLENBQWtCLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLO3dCQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBRXBELElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO3dCQUMxQixJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUMzQixPQUFPLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO3FCQUNoRTt5QkFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUcsSUFBSTt3QkFDckMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFFLG1DQUFtQzt3QkFDckUsSUFBSSxHQUFHLEdBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFDOUIsR0FBRyxHQUFHLENBQUMsR0FBRyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBRXZELE9BQU8sT0FBTyxHQUFHLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7cUJBQ3ZEO3lCQUFNO3dCQUNOLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQ3hCLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUU1QixPQUFPLE9BQU8sR0FBRyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO3FCQUN2RDtpQkFDRDtxQkFBTSxFQUFHLGFBQWE7b0JBQ3RCLElBQUksR0FBRyxHQUFXLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFFbEQsSUFBSSxDQUFDLEdBQUc7d0JBQUUsT0FBTyxFQUFHLENBQUM7b0JBRXJCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBYSxFQUFFLEVBQUU7d0JBQ3ZELFlBQVk7d0JBQ1osSUFBSSxLQUFLLENBQWtCLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLOzRCQUFFLEtBQUssSUFBSSxDQUFDLENBQUM7d0JBQzVELE9BQU8sS0FBSyxDQUFDO29CQUNkLENBQUMsQ0FBQyxDQUFDO2lCQUNIO2FBQ0Q7aUJBQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDakMsSUFBSSxHQUFHLEdBQWEsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRTNDLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBRW5DLElBQUksR0FBRyxHQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRWhDLElBQUksQ0FBQyxHQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFDaEQsR0FBRyxHQUFHLENBQUMsR0FBRyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRXZELE9BQU8sT0FBTyxHQUFHLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7YUFDdkQ7aUJBQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDaEMsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDckM7WUFFRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlHLENBQUMsQ0FBQyxRQUFRO1FBRUgsTUFBTSxDQUFDLEdBQVcsRUFBRSxLQUFVO1lBQ3BDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzNCLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFO29CQUNsQyxJQUFJLEdBQUcsR0FBYSxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDNUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFFcEMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUN6QyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDeEIsWUFBWTtvQkFDWixJQUFJLEtBQUssQ0FBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUs7d0JBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFFcEQsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLEVBQUU7d0JBQzFCLElBQUksR0FBRyxZQUFZLEtBQUssRUFBRTs0QkFDekIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzt5QkFDNUI7NkJBQU07NEJBQ04sR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQzs0QkFDZixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO3lCQUM3QjtxQkFDRDt5QkFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUcsSUFBSTt3QkFDckMsSUFBSSxHQUFHLFlBQVksS0FBSyxFQUFFOzRCQUN6QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUN0RDs2QkFBTTs0QkFDTixHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDOzRCQUN6QyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO3lCQUM3QjtxQkFDRDt5QkFBTTt3QkFDTixJQUFJLEdBQUcsWUFBWSxLQUFLLEVBQUU7NEJBQ3pCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUN6Qzs2QkFBTTs0QkFDTixHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQzs0QkFDNUIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQzt5QkFDN0I7cUJBQ0Q7aUJBQ0Q7cUJBQU07b0JBQ04sTUFBTSxTQUFTLENBQUMsT0FBTyxDQUFDO2lCQUN4QjthQUNEO2lCQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksR0FBRyxHQUFhLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMzQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUVuQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQ3hDLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUV4QixJQUFJLEdBQUcsWUFBWSxLQUFLLEVBQUU7b0JBQ3pCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7aUJBQzVCO3FCQUFNO29CQUNOLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7b0JBQ2YsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztpQkFDN0I7YUFDRDtZQUVELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQyxRQUFRO1FBRUgsT0FBTztZQUNiLElBQUksSUFBSSxHQUFVLElBQUksS0FBSyxFQUFFLENBQUM7WUFFOUIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFMUIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDLENBQUMsU0FBUztRQUVKLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBWSxFQUFFLElBQWE7WUFDN0MsSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBRW5KLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUNwQyxRQUFRLEdBQVcsQ0FBQyxDQUFDLEVBQ3JCLE1BQU0sR0FBVyxFQUFFLEVBQ25CLFVBQVUsR0FBVyxFQUFFLEVBQ3ZCLEtBQUssR0FBVSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFDOUIsS0FBSyxHQUFXLENBQUMsQ0FBQztZQUVuQixLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtnQkFDdkIsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFL0MsSUFBSSxRQUFRLEtBQUssQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pELFFBQVEsRUFBRSxDQUFDO29CQUVYLElBQUksS0FBSyxHQUFhLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUUvQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQzt3QkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSx3REFBd0QsS0FBSyxJQUFJLFFBQUcsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUMvSCxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQzt3QkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSwyREFBMkQsS0FBSyxJQUFJLFFBQUcsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUNsSSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxvRUFBb0UsS0FBSyxJQUFJLFFBQUcsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUN4SyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN2RjtxQkFBTSxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRTtvQkFDdkQsTUFBTSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUU3QixJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQzt3QkFBRSxRQUFRLEVBQUUsQ0FBQztpQkFDMUM7cUJBQU0sSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEVBQUU7b0JBQ3pCLElBQUksRUFBRSxRQUFRLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3RCLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO3FCQUM3RDt5QkFBTSxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUMsRUFBRTt3QkFDekIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7cUJBQzlCO3lCQUFNO3dCQUNOLE1BQU0sSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztxQkFDN0I7aUJBQ0Q7cUJBQU07b0JBQ04sSUFBSSxNQUFNLENBQUMsVUFBVSxLQUFLLElBQUk7d0JBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRTlELEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQ2hCO2dCQUVELEtBQUssRUFBRSxDQUFDO2FBQ1I7WUFFRCxJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUM7Z0JBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU3QyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUMsQ0FBQyxNQUFNO0tBRVIsQ0FBQyxPQUFPO0lBMU1SO1FBREMsVUFBVTs7MkNBU1Q7SUE3QlUsU0FBSyxRQStOakIsQ0FBQTtJQUVELE1BQWEsV0FBVztRQUt2QixZQUFzQixJQUFZLEVBQXFCLE1BQWE7WUFBYixXQUFNLEdBQU4sTUFBTSxDQUFPO1lBQ25FLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEYsQ0FBQyxDQUFDLE1BQU07UUFFRCxNQUFNLENBQUMsS0FBSyxDQUFDLElBQVksRUFBRSxNQUFhO1lBQzlDLElBQUksR0FBaUMsQ0FBQztZQUV0QyxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBVyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUMzRyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7YUFDbEM7aUJBQU07Z0JBQ04sT0FBTyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7YUFDckM7UUFDRixDQUFDLENBQUMsT0FBTztRQUVULFdBQVc7UUFDSixLQUFLLENBQUMsSUFBSTtZQUNoQixPQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDLENBQUMsTUFBTTtLQUVSLENBQUMsYUFBYTtJQXhCRixlQUFXLGNBd0J2QixDQUFBO0lBR0QsSUFBaUIsWUFBWSxDQTZhNUI7SUE3YUQsV0FBaUIsWUFBWTtRQUM1QixNQUFhLEdBQUksU0FBUSxXQUFXO1lBS25DLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBSkYsT0FBRSxHQUFXLEtBQUssQ0FBQztnQkFDbkIsUUFBRyxHQUFvQixDQUFDLENBQUM7Z0JBSzNDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQztvQkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSwyQ0FBMkMsUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRXpJLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDO2dCQUN2QyxJQUFJLEtBQUssQ0FBa0IsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUU7b0JBQ25ELFlBQVk7b0JBQ1osSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7aUJBQ2Q7WUFDRixDQUFDLENBQUMsTUFBTTtZQUVELEtBQUssQ0FBQyxJQUFJO2dCQUNoQixJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRXRDLElBQUksT0FBTyxJQUFJLENBQUMsR0FBRyxLQUFLLFFBQVEsRUFBRTtvQkFDakMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2lCQUM1QztxQkFBTTtvQkFDTixJQUFJLEdBQUcsWUFBWSxLQUFLLEVBQUU7d0JBQ3pCLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7cUJBQ3ZDO3lCQUFNO3dCQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3FCQUNoRTtpQkFDRDtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBakNNLGdCQUFHLE1BaUNmLENBQUE7UUFFRCxNQUFhLEdBQUksU0FBUSxHQUFHO1lBRTNCLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDckIsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssUUFBUSxFQUFFO29CQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ3BFO3FCQUFNO29CQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUN4RjtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBaEJNLGdCQUFHLE1BZ0JmLENBQUE7UUFFRCxNQUFhLEdBQUksU0FBUSxHQUFHO1lBSzNCLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBSnJCLFdBQVc7Z0JBQ1EsUUFBRyxHQUFvQixDQUFDLENBQUM7WUFJNUMsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssUUFBUSxFQUFFO29CQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ3BFO3FCQUFNO29CQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUN4RjtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBbkJNLGdCQUFHLE1BbUJmLENBQUE7UUFFRCxNQUFhLEdBQUksU0FBUSxHQUFHO1lBRTNCLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDckIsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssUUFBUSxFQUFFO29CQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ3BFO3FCQUFNO29CQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUN4RjtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBaEJNLGdCQUFHLE1BZ0JmLENBQUE7UUFFRCxNQUFhLEdBQUksU0FBUSxHQUFHO1lBRTNCLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDckIsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssUUFBUSxFQUFFO29CQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ3BFO3FCQUFNO29CQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUN4RjtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBaEJNLGdCQUFHLE1BZ0JmLENBQUE7UUFFRCxNQUFhLEdBQUksU0FBUSxXQUFXO1lBS25DLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBSkYsU0FBSSxHQUFpQyxDQUFDLENBQUM7Z0JBQ3ZDLE9BQUUsR0FBVyxLQUFLLENBQUM7Z0JBS3JDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQztvQkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSw0Q0FBNEMsUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQztvQkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSwyREFBMkQsUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRXpKLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUM5QixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDNUI7cUJBQU07b0JBQ04sSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUM1QjtnQkFFRCxJQUFJLEtBQUssQ0FBa0IsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUU7b0JBQ3BELFlBQVk7b0JBQ1osSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7aUJBQ2Y7WUFDRixDQUFDLENBQUMsTUFBTTtZQUVELEtBQUssQ0FBQyxJQUFJO2dCQUNoQixJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7b0JBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN2QztxQkFBTSxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7b0JBQ3pDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQzNEO2dCQUVELE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQyxDQUFDLE1BQU07U0FFUixDQUFDLEtBQUs7UUFsQ00sZ0JBQUcsTUFrQ2YsQ0FBQTtRQUVELE1BQWEsR0FBSSxTQUFRLFdBQVc7WUFJbkMsWUFBWSxJQUFZLEVBQUUsTUFBYTtnQkFDdEMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFIRixhQUFRLEdBQW9CLENBQUMsQ0FBQztnQkFLaEQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLDhDQUE4QyxRQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFFNUksSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVoQyxJQUFJLEtBQUssQ0FBa0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUU7b0JBQ3hELFlBQVk7b0JBQ1osSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUM7aUJBQ25CO1lBQ0YsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxLQUFLLEdBQVcsQ0FBQyxDQUFDO2dCQUV0QixJQUFJLE9BQU8sSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLEVBQUU7b0JBQ3RDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7aUJBQzFDO3FCQUFNO29CQUNOLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO2lCQUN0QjtnQkFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUE2QixFQUFFLEdBQTBCLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN4SCxDQUFDLENBQUMsTUFBTTtTQUVSLENBQUMsS0FBSztRQTdCTSxnQkFBRyxNQTZCZixDQUFBO1FBRUQsTUFBYSxLQUFNLFNBQVEsV0FBVztZQUlyQyxZQUFZLElBQVksRUFBRSxNQUFhO2dCQUN0QyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUVwQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUM7b0JBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsZ0NBQWdDLE1BQU0sQ0FBQyxNQUFNLEtBQUssUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRWxKLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QixDQUFDLENBQUMsTUFBTTtZQUVELEtBQUssQ0FBQyxJQUFJO2dCQUNoQixPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxPQUFPO1FBaEJJLGtCQUFLLFFBZ0JqQixDQUFBO1FBRUQsTUFBYSxHQUFJLFNBQVEsV0FBVztZQUluQyxZQUFZLElBQVksRUFBRSxNQUFhO2dCQUN0QyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUVwQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUM7b0JBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsMkNBQTJDLFFBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUV6SSxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTFCLElBQUksS0FBSyxDQUFrQixJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssRUFBRTtvQkFDbEQsWUFBWTtvQkFDWixJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDYjtZQUNGLENBQUMsQ0FBQyxNQUFNO1lBRUQsS0FBSyxDQUFDLElBQUk7Z0JBQ2hCLElBQUksT0FBTyxJQUFJLENBQUMsRUFBRSxLQUFLLFFBQVEsRUFBRTtvQkFDaEMsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQ3BDLElBQUksR0FBRyxHQUFXLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQWdCLEVBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUUsNkVBQTZFO3dCQUVuTixJQUFJLEdBQUcsR0FBRyxDQUFDOzRCQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLFNBQVMsSUFBSSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQzt3QkFFM0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7d0JBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDO3FCQUN6Qzt5QkFBTTt3QkFDTixJQUFJLEdBQUcsR0FBVyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQWtCLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQWtCLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFDeEosR0FBRyxHQUFXLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQWdCLEVBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7d0JBRTdILElBQUksR0FBRyxHQUFHLENBQUM7NEJBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO3dCQUUzRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFDckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO3FCQUMvQjtpQkFDRDtxQkFBTTtvQkFDTixJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTt3QkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBRXZILElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUNuQztnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBN0NNLGdCQUFHLE1BNkNmLENBQUE7UUFFRCxNQUFhLEVBQUcsU0FBUSxXQUFXO1lBTWxDLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBTEosT0FBRSxHQUFZLEtBQUssQ0FBQztnQkFDbEIsU0FBSSxHQUFXLEtBQUssQ0FBQztnQkFDckIsT0FBRSxHQUFvQixDQUFDLENBQUM7Z0JBSzFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQztvQkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSwyQ0FBMkMsUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRXpJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ2xDLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO2lCQUNmO2dCQUVELElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUVyQyxJQUFJLEtBQUssQ0FBa0IsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEtBQUssRUFBRTtvQkFDOUMsWUFBWTtvQkFDWixJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDYjtZQUNGLENBQUMsQ0FBQyxNQUFNO1lBRUQsS0FBSyxDQUFDLElBQUk7Z0JBQ2hCLElBQUksT0FBTyxJQUFJLENBQUMsRUFBRSxLQUFLLFFBQVEsRUFBRTtvQkFDaEMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFO3dCQUNaLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFOzRCQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztxQkFDdkc7eUJBQU07d0JBQ04sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUU7NEJBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3FCQUN0RztpQkFDRDtxQkFBTTtvQkFDTixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUU7d0JBQ1osSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7cUJBQzNIO3lCQUFNO3dCQUNOLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3FCQUMxSDtpQkFDRDtnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxJQUFJO1FBekNPLGVBQUUsS0F5Q2QsQ0FBQTtRQUVELE1BQWEsR0FBSSxTQUFRLFdBQVc7WUFJbkMsWUFBWSxJQUFZLEVBQUUsTUFBYTtnQkFDdEMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFIRixZQUFPLEdBQVcsS0FBSyxDQUFDO1lBSTNDLENBQUMsQ0FBQyxNQUFNO1lBRUQsS0FBSyxDQUFDLElBQUk7Z0JBQ2hCLElBQUksSUFBSSxHQUFhLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUUzQyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7b0JBQ2hCLEtBQUssSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO3dCQUN2QixJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFOzRCQUMzQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO3lCQUNuRTs2QkFBTTs0QkFDTixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUNsRTtxQkFDRDtpQkFDRDtxQkFBTTtvQkFDTixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztpQkFDekU7Z0JBRUQsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDLENBQUMsTUFBTTtTQUVSLENBQUMsS0FBSztRQTFCTSxnQkFBRyxNQTBCZixDQUFBO1FBRUQsTUFBYSxHQUFJLFNBQVEsV0FBVztZQUluQyxZQUFZLElBQVksRUFBRSxNQUFhO2dCQUN0QyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUhGLE9BQUUsR0FBVyxLQUFLLENBQUM7Z0JBS3JDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQztvQkFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxnQ0FBZ0MsUUFBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakksQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRTtvQkFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFO3dCQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDaEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO3dCQUNuQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ1osQ0FBQyxDQUFDLENBQUM7b0JBR0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNyQyxDQUFDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxNQUFNO1NBRVIsQ0FBQyxLQUFLO1FBdkJNLGdCQUFHLE1BdUJmLENBQUE7UUFFRCxNQUFhLE1BQU8sU0FBUSxXQUFXO1lBUXRDLFlBQVksSUFBWSxFQUFFLE1BQWE7Z0JBQ3RDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBTEYsT0FBRSxHQUFXLEtBQUssQ0FBQztnQkFDbkIsU0FBSSxHQUFXLE1BQU0sQ0FBQztnQkFDdEIsU0FBSSxHQUFZLEtBQUssQ0FBQztnQkFLeEMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxFQUFFLEVBQUU7b0JBQ2xDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO29CQUNqQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQzVCO3FCQUFNO29CQUNOLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDNUI7WUFDRixDQUFDLENBQUMsTUFBTTtZQUVELEtBQUssQ0FBQyxJQUFJO2dCQUNoQixJQUFJLEdBQXFCLENBQUM7Z0JBRTFCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksS0FBSyxFQUFFO29CQUMzRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDNUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFhLEVBQUUsR0FBVyxFQUFFLEVBQUU7NEJBQ3BFLEdBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO3dCQUNwRCxDQUFDLENBQUMsQ0FBQzt3QkFFSCxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7NEJBQ2QsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7eUJBQ2pCOzZCQUFNOzRCQUNOLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3lCQUNqQztxQkFDRDt5QkFBTTt3QkFDTixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO3FCQUMzQztpQkFDRDtxQkFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLFVBQVUsRUFBRTtvQkFDckMsSUFBSSxHQUFRLENBQUM7b0JBRWIsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUNkLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQWEsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3FCQUM1Rjt5QkFBTTt3QkFDTixHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBYSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQ3RGO29CQUVELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7aUJBQ2pDO3FCQUFNO29CQUNOLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksa0JBQWtCLENBQUMsQ0FBQztpQkFDeEQ7Z0JBRUQsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDLENBQUMsTUFBTTtTQUVSLENBQUMsUUFBUTtRQXJERyxtQkFBTSxTQXFEbEIsQ0FBQTtRQUVELE1BQWEsR0FBSSxTQUFRLFdBQVc7WUFLbkMsWUFBWSxJQUFZLEVBQUUsTUFBYTtnQkFDdEMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFIRixPQUFFLEdBQVcsS0FBSyxDQUFDO2dCQUtyQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUM7b0JBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsMENBQTBDLFFBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUUxSSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0IsQ0FBQyxDQUFDLE1BQU07WUFFRCxLQUFLLENBQUMsSUFBSTtnQkFDaEIsSUFBSSxJQUFJLEdBQVcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLGNBQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO29CQUFFLElBQUksSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDO2dCQUVqRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBNkIsRUFBRSxHQUF5QixFQUFFLEVBQUU7b0JBQy9FLG1CQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBVSxFQUFFLElBQVksRUFBRSxFQUFFO3dCQUMzQyxJQUFJLEdBQUcsRUFBRTs0QkFDUixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7NEJBQ1QsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO3lCQUNyQzs2QkFBTTs0QkFDTixJQUFJLEdBQUcsR0FBVSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxlQUFRLENBQUMsSUFBSSxFQUFFLGNBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQzVFLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDOzRCQUMxQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDOzRCQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQzs0QkFDdEMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO3lCQUNYO29CQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDLE1BQU07U0FFUixDQUFDLEtBQUs7UUFqQ00sZ0JBQUcsTUFpQ2YsQ0FBQTtJQUVGLENBQUMsRUE3YWdCLFlBQVksR0FBWixnQkFBWSxLQUFaLGdCQUFZLFFBNmE1QixDQUFDLGNBQWM7SUFFaEIsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBNkI7UUFDMUQsQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QyxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEMsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUMscUJBQXFCLEVBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNDLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUM5QixDQUFDLENBQUM7SUFHSSxLQUFLLFVBQVUsSUFBSSxDQUFDLElBQVk7UUFDdEMsSUFBSSxjQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUFFLElBQUksSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDO1FBRWpELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUEyQixFQUFFLEdBQXlCLEVBQUUsRUFBRTtZQUM3RSxtQkFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEdBQVUsRUFBRSxJQUFZLEVBQUUsRUFBRTtnQkFDM0MsSUFBSSxHQUFHLEVBQUU7b0JBQ1IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2lCQUNUO3FCQUFNO29CQUNOLElBQUksR0FBRyxHQUFVLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQzdDLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUMxQixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ1Q7WUFDRixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLE1BQU07SUFkYyxRQUFJLE9BY3pCLENBQUE7SUFFRCxTQUFTLE1BQU0sQ0FBQyxHQUFVLEVBQUUsT0FBZ0I7UUFDM0MsSUFBSSxPQUFPO1lBQUUsR0FBRyxDQUFDLE9BQU8sSUFBSSxRQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUVwRCxNQUFNLEdBQUcsQ0FBQztJQUNYLENBQUMsQ0FBQyxRQUFRO0lBRVYsWUFBWTtJQUNaLFNBQVMsVUFBVSxDQUFDLE1BQWMsRUFBRSxXQUE0QjtRQUMvRCxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUc7WUFDM0MsVUFBVSxFQUFFLEtBQUs7WUFDakIsWUFBWSxFQUFFLElBQUk7WUFDbEIsUUFBUSxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsWUFBWTtBQUVmLENBQUMsRUFsd0JhLEdBQUcsR0FBSCxXQUFHLEtBQUgsV0FBRyxRQWt3QmhCLENBQUMsS0FBSztBQUVQLGtCQUFlLEdBQUcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tIFwiZnMtZXh0cmFcIjtcclxuaW1wb3J0IHsgRU9MIH0gZnJvbSBcIm9zXCI7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcclxuaW1wb3J0IHsgZXh0bmFtZSwgYmFzZW5hbWUgfSBmcm9tIFwicGF0aFwiO1xyXG5cclxuXHJcbmV4cG9ydCBtb2R1bGUgSlNBIHtcclxuXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBjb25maWcge1xyXG5cdFx0ZXhwb3J0IHZhciBleHRuYW1lOiBzdHJpbmcgPSBcIi5qc2FcIjtcclxuXHRcdGV4cG9ydCB2YXIgam1wbGFiOiBzdHJpbmcgPSAnOic7XHJcblx0XHRleHBvcnQgdmFyIGFycmF5c2VwOiBzdHJpbmcgPSAnLCc7XHJcblx0XHRleHBvcnQgdmFyIHN0YXJ0c21ibDogc3RyaW5nID0gXCJfX1NUQVJUX1wiO1xyXG5cdFx0ZXhwb3J0IHZhciBlbmRzbWJsOiBzdHJpbmcgPSBcIl9fRU5EX1wiO1xyXG5cdFx0ZXhwb3J0IHZhciBiYXNlOiBzdHJpbmcgPSBcIl9fQkFTRV9fXCI7XHJcblx0XHRleHBvcnQgdmFyIGFzbjogc3RyaW5nID0gXCJhc25cIjtcclxuXHRcdGV4cG9ydCB2YXIgYXc6IHN0cmluZyA9IFwiYXdcIjtcclxuXHRcdGV4cG9ydCB2YXIgZm46IHN0cmluZyA9IFwiZGVmXCI7XHJcblx0XHRleHBvcnQgdmFyIGlzU2NvcGVFbmQ6IHN0cmluZyA9IFwiZW5kXCI7XHJcblx0XHRleHBvcnQgdmFyIHNlcDogc3RyaW5nID0gJyAnO1xyXG5cdFx0ZXhwb3J0IHZhciBlbmRsOiBzdHJpbmcgPSBFT0w7XHJcblx0XHRleHBvcnQgdmFyIHNlcF9yOiBSZWdFeHAgPSAvKD88IVxcXFwpIC9nbTtcclxuXHRcdGV4cG9ydCB2YXIgZW5kbF9yOiBSZWdFeHAgPSAvKD88IVxcXFwpXFxuL2dtO1xyXG5cclxuXHRcdC8vU0VDT05EIEVYUEFOU0lPTlxyXG5cdFx0ZXhwb3J0IHZhciBpc1Njb3BlOiBSZWdFeHAgPSBuZXcgUmVnRXhwKFwiXihcIiArIGFzbiArIFwiICk/KFwiICsgZm4gKyBcIikgP1wiLCAnJyk7XHJcblx0XHRleHBvcnQgdmFyIGNvbW1lbnQ6IFJlZ0V4cCA9IC8jLiokL2lzXHJcblx0XHRleHBvcnQgdmFyIGluZGV4OiBSZWdFeHAgPSAvXFxbKC4rKT9cXF18XFwoKC4rKT9cXCkvbXM7XHJcblx0XHRleHBvcnQgdmFyIHN0cjogUmVnRXhwID0gL15bJ1wiXSguKyk/WydcIl0kL21zO1xyXG5cdFx0ZXhwb3J0IHZhciBwcm9wOiBSZWdFeHAgPSAvXFwuKC4rKSQvbXM7XHJcblx0XHRleHBvcnQgdmFyIGVzY3M6IFJlZ0V4cCA9IC8oPzwhXFxcXClcXFxcL2dtXHJcblx0fSAvL2NvbmZpZ1xyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIEpTQUVycm9ycyB7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRE46IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIE5hbWUuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURTOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBTY29wZS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRENBTDogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgcGFyYW1ldGVycy5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRFNZTjogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgU3ludGF4LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFSU5TTk9URVg6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiSW5zdHJ1Y3Rpb24gZG9lcyBub3QgZXhpc3QuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURKTVA6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIEp1bXAuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURQVEg6IFJlZmVyZW5jZUVycm9yID0gbmV3IFJlZmVyZW5jZUVycm9yKFwiQmFkIFBhdGguXCIpO1xyXG5cdH0gLy9KU0FFcnJvcnNcclxuXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBTY29wZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdFx0cmVhZG9ubHkgc2NvcGVzOiBNYXA8c3RyaW5nLCBTY29wZT4gPSBuZXcgTWFwPHN0cmluZywgU2NvcGU+KCk7XHJcblx0XHRyZWFkb25seSByZWdpc3RlcnM6IE1hcDxzdHJpbmcsIGFueT4gPSBuZXcgTWFwPHN0cmluZywgYW55PihbXHJcblx0XHRcdFtcImFjY1wiLCAwXSxcclxuXHRcdFx0W1wiam14XCIsIDBdLFxyXG5cdFx0XHRbXCJqbWJcIiwgMF0sXHJcblx0XHRcdFtcIkVORExcIiwgRU9MXSxcclxuXHRcdFx0W1wiV1NQQ1wiLCAnICddLFxyXG5cdFx0XHRbXCJBUkdTXCIsIFtdXSwgIC8vbG9hZCBmcm9tIENMST9cclxuXHRcdFx0W1wiX21hdGhcIiwgTWF0aF0sXHJcblx0XHRcdFtcIl9kYXRlXCIsIERhdGVdLFxyXG5cdFx0XHRbXCJudWxsXCIsIG51bGxdLFxyXG5cdFx0XHRbXCJfcHJvY2Vzc1wiLCBwcm9jZXNzXSxcclxuXHRcdFx0W1wiX3JlcXVpcmVcIiwgcmVxdWlyZV1cclxuXHRcdF0pO1xyXG5cdFx0cmVhZG9ubHkgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gWyBdO1xyXG5cclxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyA9IGNvbmZpZy5iYXNlO1xyXG5cclxuXHRcdEBlbnVtZXJhYmxlXHJcblx0XHRyZWFkb25seSBfc3RyZWFtczoge1xyXG5cdFx0XHRpbnB1dDogTm9kZUpTLlJlYWRTdHJlYW0sXHJcblx0XHRcdG91dHB1dDogTm9kZUpTLldyaXRlU3RyZWFtLFxyXG5cdFx0XHRlcnJvcjogTm9kZUpTLldyaXRlU3RyZWFtXHJcblx0XHR9ID0ge1xyXG5cdFx0XHRpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuXHRcdFx0b3V0cHV0OiBwcm9jZXNzLnN0ZG91dCxcclxuXHRcdFx0ZXJyb3I6IHByb2Nlc3Muc3RkZXJyXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5hbWU/OiBzdHJpbmcpIHtcclxuXHRcdFx0c3VwZXIoKTtcclxuXHRcdFx0dGhpcy5uYW1lID0gbmFtZSB8fCB0aGlzLm5hbWU7XHJcblxyXG5cdFx0XHR0aGlzLl9zdHJlYW1zLmlucHV0LnNldFJhd01vZGUodHJ1ZSk7XHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8dm9pZD4ge1xyXG5cdFx0XHRmb3IgKDsgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpIDwgdGhpcy5pbnN0cnVjdGlvbnMubGVuZ3RoOyB0aGlzLnJlZ2lzdGVycy5zZXQoXCJqbXhcIiwgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpICsgMSkpIHtcclxuXHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5pbnN0cnVjdGlvbnNbdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpXS5jYWxsKCkpIGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdHByb3RlY3RlZCBhZGQoaW5zdDogSW5zdHJ1Y3Rpb24gfCBzdHJpbmcpOiBJbnN0cnVjdGlvbiB8IHN0cmluZyB7XHJcblx0XHRcdGlmICh0eXBlb2YgaW5zdCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdGlmIChpbnN0ID09PSAnJykgcmV0dXJuIGluc3Q7XHJcblxyXG5cdFx0XHRcdGluc3QgPSBJbnN0cnVjdGlvbi5wYXJzZShpbnN0LCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5pbnN0cnVjdGlvbnMucHVzaChpbnN0KTtcclxuXHJcblx0XHRcdHJldHVybiBpbnN0O1xyXG5cdFx0fSAvL2FkZFxyXG5cclxuXHRcdHB1YmxpYyBnZXRSZWcocmVnOiBzdHJpbmcgfCBudW1iZXIpOiBhbnkge1xyXG5cdFx0XHRpZiAodHlwZW9mIHJlZyA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdHJldHVybiByZWc7XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLmluZGV4LnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGlmIChyZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKSkge1xyXG5cdFx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLmluZGV4KTtcclxuXHJcblx0XHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0bGV0IHQ6IHN0cmluZyA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKTtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dCAqIDEpID09PSBmYWxzZSkgdCAqPSAxO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHQgPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdFx0bGV0IHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyk7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0eXBlb2YgdG1wW3RdID09PSBcImZ1bmN0aW9uXCIgPyB0bXBbdF0uYmluZyh0bXApIDogdG1wW3RdO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjb25maWcuc3RyLnRlc3QodCkpIHsgIC8vRD9cclxuXHRcdFx0XHRcdFx0dCA9IHQucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpOyAgLy93aHkgbm90IHVzZSAucHJvcCBzeW50YXggaW5zdGVhZD9cclxuXHRcdFx0XHRcdFx0bGV0IHJldDogYW55ID0gdGhpcy5nZXRSZWcocmVnKSxcclxuXHRcdFx0XHRcdFx0XHR0bXAgPSAocmV0IGluc3RhbmNlb2YgU2NvcGUpID8gcmV0LmdldFJlZyh0KSA6IHJldFt0XTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybiB0eXBlb2YgdG1wID09PSBcImZ1bmN0aW9uXCIgPyB0bXAuYmluZChyZXQpIDogdG1wO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bGV0IHRtcCA9IHRoaXMuZ2V0UmVnKHJlZyksXHJcblx0XHRcdFx0XHRcdFx0XHRnb3QgPSB0bXBbdGhpcy5nZXRSZWcodCldO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuIHR5cGVvZiBnb3QgPT09IFwiZnVuY3Rpb25cIiA/IGdvdC5iaW5kKHRtcCkgOiBnb3Q7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHsgIC8vQVJSQVlTIEhFUkVcclxuXHRcdFx0XHRcdGxldCB0bXA6IHN0cmluZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIXRtcCkgcmV0dXJuIFsgXTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gdG1wLnNwbGl0KGNvbmZpZy5hcnJheXNlcCkubWFwKChjaHVuazogc3RyaW5nKSA9PiB7XHJcblx0XHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj5jaHVuayAqIDEpID09PSBmYWxzZSkgY2h1bmsgKj0gMTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGNodW5rO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5wcm9wLnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGxldCBtYXQ6IHN0cmluZ1tdID0gcmVnLm1hdGNoKGNvbmZpZy5wcm9wKTtcclxuXHJcblx0XHRcdFx0cmVnID0gcmVnLnJlcGxhY2UoY29uZmlnLnByb3AsICcnKTtcclxuXHJcblx0XHRcdFx0bGV0IHJldDogYW55ID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHJcblx0XHRcdFx0bGV0IHQ6IHN0cmluZyA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5wcm9wLCBcIiQxXCIpLFxyXG5cdFx0XHRcdFx0dG1wID0gKHJldCBpbnN0YW5jZW9mIFNjb3BlKSA/IHJldC5nZXRSZWcodCkgOiByZXRbdF07XHJcblxyXG5cdFx0XHRcdHJldHVybiB0eXBlb2YgdG1wID09PSBcImZ1bmN0aW9uXCIgPyB0bXAuYmluZChyZXQpIDogdG1wO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5zdHIudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0cmV0dXJuIHJlZy5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIik7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aGlzLnJlZ2lzdGVycy5oYXMocmVnKSA/IHRoaXMucmVnaXN0ZXJzLmdldChyZWcpIDogKHRoaXMuc2NvcGVzLmhhcyhyZWcpID8gdGhpcy5zY29wZXMuZ2V0KHJlZykgOiAwKTtcclxuXHRcdH0gLy9nZXRSZWdcclxuXHJcblx0XHRwdWJsaWMgc2V0UmVnKHJlZzogc3RyaW5nLCB2YWx1ZTogYW55KTogTWFwPHN0cmluZywgYW55PiB7ICAvL2ZvciBmdW5jcz9cclxuXHRcdFx0aWYgKGNvbmZpZy5pbmRleC50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRpZiAocmVnLnJlcGxhY2UoY29uZmlnLmluZGV4LCAnJykpIHtcclxuXHRcdFx0XHRcdGxldCBtYXQ6IHN0cmluZ1tdID0gcmVnLm1hdGNoKGNvbmZpZy5pbmRleCk7XHJcblx0XHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgdCA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKSxcclxuXHRcdFx0XHRcdFx0dG1wID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dCAqIDEpID09PSBmYWxzZSkgdCAqPSAxO1xyXG5cclxuXHRcdFx0XHRcdGlmICh0eXBlb2YgdCA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdG1wLnNldFJlZyh0LCB2YWx1ZSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dG1wW3RdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjb25maWcuc3RyLnRlc3QodCkpIHsgIC8vRD9cclxuXHRcdFx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIiksIHZhbHVlKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0bXBbdC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIildID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodGhpcy5nZXRSZWcodCksIHZhbHVlKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0bXBbdGhpcy5nZXRSZWcodCldID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aHJvdyBKU0FFcnJvcnMuRUJBRFNZTjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnByb3AudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLnByb3ApO1xyXG5cdFx0XHRcdHJlZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5wcm9wLCAnJyk7XHJcblxyXG5cdFx0XHRcdGxldCB0ID0gbWF0WzBdLnJlcGxhY2UoY29uZmlnLnByb3AsIFwiJDFcIiksXHJcblx0XHRcdFx0XHR0bXAgPSB0aGlzLmdldFJlZyhyZWcpO1xyXG5cclxuXHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdHJldHVybiB0bXAuc2V0UmVnKHQsIHZhbHVlKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dG1wW3RdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRSZWcocmVnLCB0bXApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRoaXMucmVnaXN0ZXJzLnNldChyZWcsIHZhbHVlKTtcclxuXHRcdH0gLy9zZXRSZWdcclxuXHJcblx0XHRwdWJsaWMgbWFrZU9iaigpOiBTY29wZSB7XHJcblx0XHRcdGxldCBuc2NwOiBTY29wZSA9IG5ldyBTY29wZSgpO1xyXG5cclxuXHRcdFx0T2JqZWN0LmFzc2lnbihuc2NwLCB0aGlzKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBuc2NwO1xyXG5cdFx0fSAvL21ha2VPYmpcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIGxvYWQoY29kZTogc3RyaW5nLCBuYW1lPzogc3RyaW5nKTogU2NvcGUgeyAgLy9wYXNzIHNjb3BlIGJvZHkgYXMgc3RyaW5nXHJcblx0XHRcdGNvZGUgPSBgJHtjb25maWcuc3RhcnRzbWJsfSR7Y29uZmlnLmptcGxhYn0ke2NvbmZpZy5lbmRsLnJlcGVhdCgyKX0ke2NvZGV9JHtjb25maWcuZW5kbC5yZXBlYXQoMil9JHtjb25maWcuZW5kc21ibH0ke2NvbmZpZy5qbXBsYWJ9JHtjb25maWcuZW5kbH1gO1xyXG5cclxuXHRcdFx0bGV0IGxpbmVzID0gY29kZS5zcGxpdChjb25maWcuZW5kbF9yKSxcclxuXHRcdFx0XHRzdWJzY29wZTogbnVtYmVyID0gLTEsXHJcblx0XHRcdFx0bnNjb3BlOiBzdHJpbmcgPSAnJyxcclxuXHRcdFx0XHRuc2NvcGVuYW1lOiBzdHJpbmcgPSAnJyxcclxuXHRcdFx0XHRzY29wZTogU2NvcGUgPSBuZXcgU2NvcGUobmFtZSksXHJcblx0XHRcdFx0bG5jbnQ6IG51bWJlciA9IDA7XHJcblxyXG5cdFx0XHRmb3IgKGxldCBsaW5lIG9mIGxpbmVzKSB7XHJcblx0XHRcdFx0bGluZSA9IGxpbmUucmVwbGFjZShjb25maWcuY29tbWVudCwgJycpLnRyaW0oKTtcclxuXHJcblx0XHRcdFx0aWYgKHN1YnNjb3BlID09PSAtMSAmJiBjb25maWcuaXNTY29wZS50ZXN0KGxpbmUpKSB7XHJcblx0XHRcdFx0XHRzdWJzY29wZSsrO1xyXG5cclxuXHRcdFx0XHRcdGxldCBwYXJ0czogc3RyaW5nW10gPSBsaW5lLnNwbGl0KGNvbmZpZy5zZXBfcik7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHBhcnRzLmxlbmd0aCA+IDMpIHRocm93cyhKU0FFcnJvcnMuRUJBRFNZTiwgYFRvbyBtYW55IHBhcmFtZXRlcnMgb24gZGVjbGFyYXRpb24sIG5lZWQgYXQgbW9zdCAzLiAoJHtsbmNudH0pJHtFT0x9JHtsaW5lfWApO1xyXG5cdFx0XHRcdFx0aWYgKHBhcnRzLmxlbmd0aCA8IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRFNZTiwgYFRvbyBsaXR0bGUgcGFyYW1ldGVycyBvbiBkZWNsYXJhdGlvbiwgbmVlZCBhdCBsZWFzdCAyLiAoJHtsbmNudH0pJHtFT0x9JHtsaW5lfWApO1xyXG5cdFx0XHRcdFx0aWYgKHBhcnRzLmxlbmd0aCA9PT0gMyAmJiBjb25maWcuYXNuICE9PSBwYXJ0c1swXSkgdGhyb3dzKEpTQUVycm9ycy5FQkFEU1lOLCBgRmlyc3QgcGFyYW1ldGVyIG11c3QgYmUgJ2FzbicsIHNlY29uZCAnZGVmJyBhbmQgdGhpcmQgdGhlIG5hbWUuICgke2xuY250fSkke0VPTH0ke2xpbmV9YCk7XHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGUudGVzdChuc2NvcGVuYW1lID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0pKSB0aHJvd3MoSlNBRXJyb3JzLkVCQUROKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlID4gLTEgJiYgY29uZmlnLmlzU2NvcGVFbmQgIT09IGxpbmUpIHtcclxuXHRcdFx0XHRcdG5zY29wZSArPSBsaW5lICsgY29uZmlnLmVuZGw7XHJcblxyXG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5pc1Njb3BlLnRlc3QobGluZSkpIHN1YnNjb3BlKys7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChzdWJzY29wZSA+IC0xKSB7XHJcblx0XHRcdFx0XHRpZiAoLS1zdWJzY29wZSA9PT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0c2NvcGUuc2NvcGVzLnNldChuc2NvcGVuYW1lLCBTY29wZS5sb2FkKG5zY29wZSwgbnNjb3BlbmFtZSkpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdWJzY29wZSA8IC0xKSB7XHJcblx0XHRcdFx0XHRcdHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGxpbmUpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bnNjb3BlICs9IGxpbmUgKyBjb25maWcuZW5kbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5pc1Njb3BlRW5kID09PSBsaW5lKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTLCBsaW5lKTtcclxuXHJcblx0XHRcdFx0XHRzY29wZS5hZGQobGluZSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRsbmNudCsrO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoc3Vic2NvcGUgIT09IC0xKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTKTtcclxuXHJcblx0XHRcdHJldHVybiBzY29wZTtcclxuXHRcdH0gLy9sb2FkXHJcblxyXG5cdH0gLy9TY29wZVxyXG5cclxuXHRleHBvcnQgY2xhc3MgSW5zdHJ1Y3Rpb24ge1xyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9wYXJhbXM6IHN0cmluZ1tdO1xyXG5cclxuXHRcdHB1YmxpYyBzdGF0aWMgbWFwcGluZ3M6IE1hcDxSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbj47XHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcHJvdGVjdGVkIHJlYWRvbmx5IHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0dGhpcy5fcGFyYW1zID0gaW5zdC5zcGxpdChjb25maWcuc2VwX3IpLm1hcChwYXJ0ID0+IHBhcnQucmVwbGFjZShjb25maWcuZXNjcywgJycpKTtcclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShsaW5lOiBzdHJpbmcsIHBhcmVudDogU2NvcGUpOiBJbnN0cnVjdGlvbiB7XHJcblx0XHRcdGxldCBpbnM6IFtSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbl07XHJcblxyXG5cdFx0XHRpZiAoKGlucyA9IEFycmF5LmZyb20oSW5zdHJ1Y3Rpb24ubWFwcGluZ3MuZW50cmllcygpKS5maW5kKChhcnIpOiBib29sZWFuID0+IGFyclswXS50ZXN0KGxpbmUpKSkgJiYgaW5zWzFdKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyAoaW5zWzFdKShsaW5lLCBwYXJlbnQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiBuZXcgSW5zdHJ1Y3Rpb24obGluZSwgcGFyZW50KTtcclxuXHRcdFx0fVxyXG5cdFx0fSAvL3BhcnNlXHJcblxyXG5cdFx0Ly9AT3ZlcnJpZGVcclxuXHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRyZXR1cm4gdGhyb3dzKEpTQUVycm9ycy5FSU5TTk9URVgsIGAke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0fSAvL2NhbGxcclxuXHJcblx0fSAvL0luc3RydWN0aW9uXHJcblxyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIEluc3RydWN0aW9ucyB7XHJcblx0XHRleHBvcnQgY2xhc3MgQWRkIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgPSBcImFjY1wiO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbnVtOiBudW1iZXIgfCBzdHJpbmcgPSAxO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgdmFsdWUuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy5udW0gPSB0aGlzLl9wYXJhbXNbMV0gfHwgdGhpcy5udW07XHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy5udW0gKiAxKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy5udW0gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgcmVnID0gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pO1xyXG5cclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgcmVnICsgdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAocmVnIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRcdFx0cmVnLnB1c2godGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgcmVnICsgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0FkZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBTdWIgZXh0ZW5kcyBBZGQge1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLSB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vU3ViXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIE11bCBleHRlbmRzIEFkZCB7XHJcblxyXG5cdFx0XHQvL0BPdmVycmlkZVxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbnVtOiBudW1iZXIgfCBzdHJpbmcgPSAyO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKiB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgKiB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTXVsXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIERpdiBleHRlbmRzIE11bCB7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAvIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAvIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9EaXZcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTW9kIGV4dGVuZHMgRGl2IHtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICUgdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICUgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01vZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNb3YgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZnJvbTogbnVtYmVyIHwgc3RyaW5nIHwgQXJyYXk8YW55PiA9IDA7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nID0gXCJhY2NcIjtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoIDwgMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IGxlYXN0IDEsIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMiwgdGhlIGFkZHJlc3MgYW5kIHRoZSB2YWx1ZS4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA9PT0gMykge1xyXG5cdFx0XHRcdFx0dGhpcy50byA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHRcdFx0XHRcdHRoaXMuZnJvbSA9IHRoaXMuX3BhcmFtc1syXTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy5mcm9tICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMuZnJvbSAqPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5mcm9tID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5mcm9tKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLmZyb20gPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01vdlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBTbHAgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgaW50ZXJ2YWw6IG51bWJlciB8IHN0cmluZyA9IDE7XHJcblx0XHRcdFxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBtb3N0IDEsIHRoZSBpbnRlcnZhbC4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLmludGVydmFsID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLmludGVydmFsICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMuaW50ZXJ2YWwgKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgaW50cnY6IG51bWJlciA9IDE7XHJcblxyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5pbnRlcnZhbCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdFx0aW50cnYgPSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5pbnRlcnZhbCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGludHJ2ID0gdGhpcy5pbnRlcnZhbDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKHJlczogKHZhbHVlOiBib29sZWFuKSA9PiB2b2lkLCByZWo/OiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4gc2V0VGltZW91dChyZXMsIGludHJ2KSkuYmluZCh0aGlzKSk7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL1NscFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBMYWJlbCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmc7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCAhPT0gMSkgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgTXVzdCBmb2xsb3cgdGhlIGZvcm1hdCAnbGFiZWwke2NvbmZpZy5qbXBsYWJ9Jy4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wYXJhbXNbMF07XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0xhYmVsXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIEptcCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCB0bzogc3RyaW5nIHwgbnVtYmVyO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgbGFiZWwuJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy50byA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy50byAqIDEpID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHR0aGlzLnRvICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLnRvID09PSBcInN0cmluZ1wiKSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy50by5lbmRzV2l0aChjb25maWcuam1wbGFiKSkge1xyXG5cdFx0XHRcdFx0XHRsZXQgdG1wOiBudW1iZXIgPSB0aGlzLnBhcmVudC5pbnN0cnVjdGlvbnMuZmluZEluZGV4KChpbnM6IEluc3RydWN0aW9uKTogYm9vbGVhbiA9PiAoaW5zIGluc3RhbmNlb2YgTGFiZWwpICYmIGlucy5uYW1lID09PSB0aGlzLnRvKTsgIC8vZmlyc3QtdGltZS1pbml0aWFsaXphdGlvbiBoYXBwZW5zIHVwb24gZXhlY3V0aW9uIHRvIGVuc3VyZSBsYWJlbHMgYWxsIGV4aXN0XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodG1wIDwgMCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgTGFiZWwgJHt0aGlzLnRvfSBkb2VzIG5vdCBleGlzdC5gKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImptYlwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy50byA9IHRtcCk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRsZXQgbGFiOiBzdHJpbmcgPSB0aGlzLnBhcmVudC5yZWdpc3RlcnMuaGFzKDxzdHJpbmc+PHVua25vd24+dGhpcy50bykgPyB0aGlzLnBhcmVudC5nZXRSZWcoPHN0cmluZz48dW5rbm93bj50aGlzLnRvKSA6IChjb25maWcuc3RhcnRzbWJsICsgY29uZmlnLmptcGxhYiksXHJcblx0XHRcdFx0XHRcdFx0dG1wOiBudW1iZXIgPSB0aGlzLnBhcmVudC5pbnN0cnVjdGlvbnMuZmluZEluZGV4KChpbnM6IEluc3RydWN0aW9uKTogYm9vbGVhbiA9PiAoaW5zIGluc3RhbmNlb2YgTGFiZWwpICYmIGlucy5uYW1lID09PSBsYWIpO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKHRtcCA8IDApIHRocm93cyhKU0FFcnJvcnMuRUJBREpNUCwgYExhYmVsICR7dGhpcy50b30gZG9lcyBub3QgZXhpc3QuYCk7XHJcblxyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbWJcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRtcCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnRvIDwgMCB8fCB0aGlzLnRvID49IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5sZW5ndGgpIHRocm93cyhKU0FFcnJvcnMuRUJBREpNUCwgYEludmFsaWQganVtcCB0byAke3RoaXMudG99YCk7XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam1iXCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSk7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy50byk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0ptcFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBJZiBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgZXE6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGZyb206IHN0cmluZyA9IFwiYWNjXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nIHwgbnVtYmVyID0gMDtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMSwgdGhlIHZhbHVlLiR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXNbMF0uZW5kc1dpdGgoJ2UnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5lcSA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdIHx8IHRoaXMudG87XHJcblxyXG5cdFx0XHRcdGlmIChpc05hTig8bnVtYmVyPjx1bmtub3duPnRoaXMudG8pID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHR0aGlzLnRvICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLnRvID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy5lcSkge1xyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZnJvbSkgIT0gdGhpcy50bykgdGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSArIDEpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pIDwgdGhpcy50bykgdGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSArIDEpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy5lcSkge1xyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZnJvbSkgIT0gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZnJvbSkgPCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykpIHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikgKyAxKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSWZcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgUHJ0IGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGRlZmF1bHQ6IHN0cmluZyA9IFwiYWNjXCI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0bGV0IHByZWM6IHN0cmluZ1tdID0gdGhpcy5fcGFyYW1zLnNsaWNlKDEpO1xyXG5cclxuXHRcdFx0XHRpZiAocHJlYy5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdGZvciAobGV0IHBhcmFtIG9mIHByZWMpIHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbmZpZy5zdHIudGVzdChwYXJhbSkpIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5vdXRwdXQud3JpdGUocGFyYW0ucmVwbGFjZShjb25maWcuc3RyLCBcIiQxXCIpKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5vdXRwdXQud3JpdGUodGhpcy5wYXJlbnQuZ2V0UmVnKHBhcmFtKSArICcnKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5vdXRwdXQud3JpdGUodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZGVmYXVsdCkgKyAnJyk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL1BydFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBJbnAgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCAhPT0gMSkgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGV4YWN0bHkgMC4ke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMuaW5wdXQub25jZShcInJlYWRhYmxlXCIsICgpID0+IHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50Ll9zdHJlYW1zLmlucHV0LnJlYWQoMSkpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5pbnB1dC5wYXVzZSgpO1xyXG5cdFx0XHRcdFx0XHRyZXMoZmFsc2UpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcclxuXHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5fc3RyZWFtcy5pbnB1dC5yZXN1bWUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSW5wXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIE1ldGhvZCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHRcdFx0Ly9jcmVhdGVzIHNjb3BlcyBhbmQgY2FsbHMgb25seSFcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBuYW1lOiBzdHJpbmc7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSB0bzogc3RyaW5nID0gXCJhY2NcIjtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGFyZ3M6IHN0cmluZyA9IFwiQVJHU1wiO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgaXNBdzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtc1swXSA9PT0gY29uZmlnLmF3KSB7XHJcblx0XHRcdFx0XHR0aGlzLmlzQXcgPSB0cnVlO1xyXG5cdFx0XHRcdFx0dGhpcy5uYW1lID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wYXJhbXNbMF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0bGV0IHNjcDogU2NvcGUgfCBGdW5jdGlvbjtcclxuXHJcblx0XHRcdFx0aWYgKChzY3AgPSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5uYW1lKSkgaW5zdGFuY2VvZiBTY29wZSkge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAxKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuX3BhcmFtcy5zbGljZSh0aGlzLmlzQXcgPyAyIDogMSkuZm9yRWFjaCgocGFyYW06IHN0cmluZywgaWR4OiBudW1iZXIpID0+IHtcclxuXHRcdFx0XHRcdFx0XHQoPFNjb3BlPnNjcCkuc2V0UmVnKHRoaXMuYXJncyArIGBbJHtpZHh9XWAsIHBhcmFtKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5pc0F3KSB7XHJcblx0XHRcdFx0XHRcdFx0YXdhaXQgc2NwLmNhbGwoKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRzZXRJbW1lZGlhdGUoc2NwLmNhbGwuYmluZChzY3ApKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHNjcC5tYWtlT2JqKCkpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHNjcCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcblx0XHRcdFx0XHRsZXQgZGF0OiBhbnk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHRoaXMuaXNBdykge1xyXG5cdFx0XHRcdFx0XHRkYXQgPSBhd2FpdCBzY3AoLi4udGhpcy5fcGFyYW1zLnNsaWNlKDIpLm1hcCgocGFyYW06IHN0cmluZykgPT4gdGhpcy5wYXJlbnQuZ2V0UmVnKHBhcmFtKSkpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0ZGF0ID0gc2NwKC4uLnRoaXMuX3BhcmFtcy5zbGljZSgxKS5tYXAoKHBhcmFtOiBzdHJpbmcpID0+IHRoaXMucGFyZW50LmdldFJlZyhwYXJhbSkpKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIGRhdCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGAke3RoaXMubmFtZX0gaXMgbm90IGEgc2NvcGUuYCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL01ldGhvZFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBJbmMgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgZnJvbTogc3RyaW5nO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCAhPT0gMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGV4YWN0bHkgMSwgdGhlIHBhdGguJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0bGV0IGZyb206IHN0cmluZyA9IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pO1xyXG5cdFx0XHRcdGlmIChleHRuYW1lKGZyb20pID09PSAnJykgZnJvbSArPSBjb25maWcuZXh0bmFtZTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXM6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZCwgcmVqOiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4ge1xyXG5cdFx0XHRcdFx0cmVhZEZpbGUoZnJvbSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0XHRcdFx0dGhyb3dzKEpTQUVycm9ycy5FQkFEUFRILCBgJHtmcm9tfWApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGxldCBzY3A6IFNjb3BlID0gU2NvcGUubG9hZChkYXRhLnRvU3RyaW5nKCksIGJhc2VuYW1lKGZyb20sIGV4dG5hbWUoZnJvbSkpKTtcclxuXHRcdFx0XHRcdFx0XHRzY3Auc2V0UmVnKFwiX2lzTWFpbl9cIiwgMCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHNjcCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2NvcGVzLnNldChzY3AubmFtZSwgc2NwKTtcclxuXHRcdFx0XHRcdFx0XHRyZXMoZmFsc2UpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSW5jXHJcblx0XHRcclxuXHR9IC8vSW5zdHJ1Y3Rpb25zXHJcblxyXG5cdEluc3RydWN0aW9uLm1hcHBpbmdzID0gbmV3IE1hcDxSZWdFeHAsIHR5cGVvZiBJbnN0cnVjdGlvbj4oW1xyXG5cdFx0Wy9eYWRkKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIkFkZFwiXV0sXHJcblx0XHRbL15zdWIoIC4rKT8kLywgSW5zdHJ1Y3Rpb25zW1wiU3ViXCJdXSwgIC8vRFxyXG5cdFx0Wy9ebXVsICguKykkLywgSW5zdHJ1Y3Rpb25zW1wiTXVsXCJdXSxcclxuXHRcdFsvXmRpdiAoLispJC8sIEluc3RydWN0aW9uc1tcIkRpdlwiXV0sICAvL0RcclxuXHRcdFsvXm1vZCggLispPyQvLCBJbnN0cnVjdGlvbnNbXCJNb2RcIl1dLCAgLy9EP1xyXG5cdFx0Wy9ebW92ICguKyl7MSwyfSQvLCBJbnN0cnVjdGlvbnNbXCJNb3ZcIl1dLFxyXG5cdFx0Wy9ec2xwKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlNscFwiXV0sXHJcblx0XHRbL15qbXAgKC4rKSQvLCBJbnN0cnVjdGlvbnNbXCJKbXBcIl1dLFxyXG5cdFx0Wy9eaWYoZXxsKSggLispezAsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSWZcIl1dLFxyXG5cdFx0Wy9ecHJ0KCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlBydFwiXV0sXHJcblx0XHRbL15pbnAkLywgSW5zdHJ1Y3Rpb25zW1wiSW5wXCJdXSxcclxuXHRcdFsvXmluYyAoLispezEsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSW5jXCJdXSwgIC8vSU1QTFxyXG5cdFx0Wy9eKC4rKTokLywgSW5zdHJ1Y3Rpb25zW1wiTGFiZWxcIl1dLFxyXG5cdFx0Wy9eLi8sIEluc3RydWN0aW9uc1tcIk1ldGhvZFwiXV1cclxuXHRdKTtcclxuXHJcblxyXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8U2NvcGU+IHtcclxuXHRcdGlmIChleHRuYW1lKGZpbGUpID09PSAnJykgZmlsZSArPSBjb25maWcuZXh0bmFtZTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlczogKHZhbHVlOiBTY29wZSkgPT4gdm9pZCwgcmVqOiAoZXJyOiBFcnJvcikgPT4gdm9pZCkgPT4ge1xyXG5cdFx0XHRyZWFkRmlsZShmaWxlLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGxldCBzY3A6IFNjb3BlID0gU2NvcGUubG9hZChkYXRhLnRvU3RyaW5nKCkpO1xyXG5cdFx0XHRcdFx0c2NwLnNldFJlZyhcIl9pc01haW5fXCIsIDEpO1xyXG5cdFx0XHRcdFx0cmVzKHNjcCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0gLy9sb2FkXHJcblxyXG5cdGZ1bmN0aW9uIHRocm93cyhlcnI6IEVycm9yLCBtZXNzYWdlPzogc3RyaW5nKTogbmV2ZXIge1xyXG5cdFx0aWYgKG1lc3NhZ2UpIGVyci5tZXNzYWdlICs9IEVPTC5yZXBlYXQoMikgKyBtZXNzYWdlO1xyXG5cclxuXHRcdHRocm93IGVycjtcclxuXHR9IC8vdGhyb3dzXHJcblxyXG5cdC8vQERlY29yYXRvclxyXG5cdGZ1bmN0aW9uIGVudW1lcmFibGUodGFyZ2V0OiBPYmplY3QsIHByb3BlcnR5S2V5OiBzdHJpbmcgfCBzeW1ib2wpOiB2b2lkIHtcclxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5S2V5LCAge1xyXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcclxuXHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxyXG5cdFx0XHR3cml0YWJsZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fSAvL2VudW1lcmFibGVcclxuXHJcbn0gLy9KU0FcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEpTQTtcclxuIl19