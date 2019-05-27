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
        config.asn = "asn";
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
        config.str = /^"(.+)"$/ms;
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
                ["ENDL", os_1.EOL]
            ]);
            this.instructions = [];
            this.isAsync = false;
            this.name = "__BASE__";
            this._streams = {
                input: process.stdin,
                output: process.stdout,
                error: process.stderr
            };
            this.name = name || this.name;
            this.isAsync = isAsync || this.isAsync;
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
                        return this.getReg(reg)[t];
                    }
                    else if (config.str.test(t)) { //D?
                        t = t.replace(config.str, "$1"); //why not use .prop syntax instead?
                        let ret = this.getReg(reg);
                        return (ret instanceof Scope) ? ret.getReg(t) : ret[t];
                    }
                    else {
                        return this.getReg(reg)[this.getReg(t)];
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
                let t = mat[0].replace(config.prop, "$1");
                return (ret instanceof Scope) ? ret.getReg(t) : ret[t];
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
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the value${os_1.EOL}${this._params.join(config.sep)}`);
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
                    throws(JSAErrors.EBADCAL, `Parameters must be at least 1, the value${os_1.EOL}${this._params.join(config.sep)}`);
                if (this._params.length > 3)
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 2, the address and the value${os_1.EOL}${this._params.join(config.sep)}`);
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
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the interval${os_1.EOL}${this._params.join(config.sep)}`);
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
                    throws(JSAErrors.EBADCAL, `Must follow the format 'label${config.jmplab}'${os_1.EOL}${this._params.join(config.sep)}`);
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
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the label${os_1.EOL}${this._params.join(config.sep)}`);
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
                    throws(JSAErrors.EBADCAL, `Parameters must be at most 2, the address and the value${os_1.EOL}${this._params.join(config.sep)}`);
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
                if (this._params.length === 1)
                    throws(JSAErrors.EBADCAL, `Parameters must be at least 1, the value${os_1.EOL}${this._params.join(config.sep)}`);
            } //ctor
            async call() {
                let prec = this._params.slice(1);
                for (let param of prec) {
                    if (config.str.test(param)) {
                        this.parent._streams.output.write(param.replace(config.str, "$1"));
                    }
                    else {
                        this.parent._streams.output.write(this.parent.getReg(param) + '');
                    }
                }
                return false;
            } //call
        } //Prt
        Instructions.Prt = Prt;
        class Method extends Instruction {
            //creates scopes only!
            constructor(inst, parent) {
                super(inst, parent);
            } //ctor
            async call() {
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
        [/^prt (.+)$/, Instructions["Prt"]],
        [/^(.+):$/, Instructions["Label"]],
        [/^./, Instruction["Method"]] //method call +[aw]
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
                    res(Scope.load(data.toString()));
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
})(JSA = exports.JSA || (exports.JSA = {})); //JSA
exports.default = JSA;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2pzYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7OztBQUViLHFEQUErQjtBQUMvQiwyQkFBeUI7QUFDekIsbUNBQXNDO0FBQ3RDLCtCQUErQjtBQUcvQixlQUFlO0FBRWYsSUFBYyxHQUFHLENBOG1CaEI7QUE5bUJELFdBQWMsR0FBRztJQUVoQixJQUFpQixNQUFNLENBcUJ0QjtJQXJCRCxXQUFpQixNQUFNO1FBQ1gsY0FBTyxHQUFXLE1BQU0sQ0FBQztRQUN6QixhQUFNLEdBQVcsR0FBRyxDQUFDO1FBQ3JCLGVBQVEsR0FBVyxHQUFHLENBQUM7UUFDdkIsZ0JBQVMsR0FBVyxVQUFVLENBQUM7UUFDL0IsY0FBTyxHQUFXLFFBQVEsQ0FBQztRQUMzQixVQUFHLEdBQVcsS0FBSyxDQUFDO1FBQ3BCLFNBQUUsR0FBVyxLQUFLLENBQUM7UUFDbkIsaUJBQVUsR0FBVyxLQUFLLENBQUM7UUFDM0IsVUFBRyxHQUFXLEdBQUcsQ0FBQztRQUNsQixXQUFJLEdBQVcsUUFBRyxDQUFDO1FBQ25CLFlBQUssR0FBVyxZQUFZLENBQUM7UUFDN0IsYUFBTSxHQUFXLGFBQWEsQ0FBQztRQUUxQyxrQkFBa0I7UUFDUCxjQUFPLEdBQVcsSUFBSSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQUEsR0FBRyxHQUFHLE1BQU0sR0FBRyxPQUFBLEVBQUUsR0FBRyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbkUsY0FBTyxHQUFXLFFBQVEsQ0FBQTtRQUMxQixZQUFLLEdBQVcscUJBQXFCLENBQUM7UUFDdEMsVUFBRyxHQUFXLFlBQVksQ0FBQztRQUMzQixXQUFJLEdBQVcsV0FBVyxDQUFDO1FBQzNCLFdBQUksR0FBVyxhQUFhLENBQUE7SUFDeEMsQ0FBQyxFQXJCZ0IsTUFBTSxHQUFOLFVBQU0sS0FBTixVQUFNLFFBcUJ0QixDQUFDLFFBQVE7SUFFVixJQUFpQixTQUFTLENB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b250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzLWV4dHJhXCI7XHJcbmltcG9ydCB7IEVPTCB9IGZyb20gXCJvc1wiO1xyXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tIFwiZXZlbnRzXCI7XHJcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tIFwicGF0aFwiO1xyXG5cclxuXHJcbi8vSU1QTDogb2JqZWN0c1xyXG5cclxuZXhwb3J0IG1vZHVsZSBKU0Ege1xyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIGNvbmZpZyB7XHJcblx0XHRleHBvcnQgdmFyIGV4dG5hbWU6IHN0cmluZyA9IFwiLmpzYVwiO1xyXG5cdFx0ZXhwb3J0IHZhciBqbXBsYWI6IHN0cmluZyA9ICc6JztcclxuXHRcdGV4cG9ydCB2YXIgYXJyYXlzZXA6IHN0cmluZyA9ICcsJztcclxuXHRcdGV4cG9ydCB2YXIgc3RhcnRzbWJsOiBzdHJpbmcgPSBcIl9fU1RBUlRfXCI7XHJcblx0XHRleHBvcnQgdmFyIGVuZHNtYmw6IHN0cmluZyA9IFwiX19FTkRfXCI7XHJcblx0XHRleHBvcnQgdmFyIGFzbjogc3RyaW5nID0gXCJhc25cIjtcclxuXHRcdGV4cG9ydCB2YXIgZm46IHN0cmluZyA9IFwiZGVmXCI7XHJcblx0XHRleHBvcnQgdmFyIGlzU2NvcGVFbmQ6IHN0cmluZyA9IFwiZW5kXCI7XHJcblx0XHRleHBvcnQgdmFyIHNlcDogc3RyaW5nID0gJyAnO1xyXG5cdFx0ZXhwb3J0IHZhciBlbmRsOiBzdHJpbmcgPSBFT0w7XHJcblx0XHRleHBvcnQgdmFyIHNlcF9yOiBSZWdFeHAgPSAvKD88IVxcXFwpIC9nbTtcclxuXHRcdGV4cG9ydCB2YXIgZW5kbF9yOiBSZWdFeHAgPSAvKD88IVxcXFwpXFxuL2dtO1xyXG5cclxuXHRcdC8vU0VDT05EIEVYUEFOU0lPTlxyXG5cdFx0ZXhwb3J0IHZhciBpc1Njb3BlOiBSZWdFeHAgPSBuZXcgUmVnRXhwKFwiXihcIiArIGFzbiArIFwiICk/KFwiICsgZm4gKyBcIikgP1wiLCAnJyk7XHJcblx0XHRleHBvcnQgdmFyIGNvbW1lbnQ6IFJlZ0V4cCA9IC8jLiokL2lzXHJcblx0XHRleHBvcnQgdmFyIGluZGV4OiBSZWdFeHAgPSAvXFxbKC4rKVxcXXxcXCgoLispXFwpL21zO1xyXG5cdFx0ZXhwb3J0IHZhciBzdHI6IFJlZ0V4cCA9IC9eXCIoLispXCIkL21zO1xyXG5cdFx0ZXhwb3J0IHZhciBwcm9wOiBSZWdFeHAgPSAvXFwuKC4rKSQvbXM7XHJcblx0XHRleHBvcnQgdmFyIGVzY3M6IFJlZ0V4cCA9IC8oPzwhXFxcXClcXFxcL2dtXHJcblx0fSAvL2NvbmZpZ1xyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIEpTQUVycm9ycyB7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRE46IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIE5hbWUuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURTOiBTeW50YXhFcnJvciA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBTY29wZS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRENBTDogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgcGFyYW1ldGVycy5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRFNZTjogU3ludGF4RXJyb3IgPSBuZXcgU3ludGF4RXJyb3IoXCJCYWQgU3ludGF4LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFSU5TTk9URVg6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiSW5zdHJ1Y3Rpb24gZG9lcyBub3QgZXhpc3QuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURKTVA6IFN5bnRheEVycm9yID0gbmV3IFN5bnRheEVycm9yKFwiQmFkIEp1bXAuXCIpO1xyXG5cdH0gLy9KU0FFcnJvcnNcclxuXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBTY29wZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHNjb3BlczogTWFwPHN0cmluZywgU2NvcGU+ID0gbmV3IE1hcDxzdHJpbmcsIFNjb3BlPigpO1xyXG5cdFx0cmVhZG9ubHkgcmVnaXN0ZXJzOiBNYXA8c3RyaW5nLCBhbnk+ID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oW1xyXG5cdFx0XHRbXCJhY2NcIiwgMF0sXHJcblx0XHRcdFtcImpteFwiLCAwXSxcclxuXHRcdFx0W1wiam1iXCIsIDBdLFxyXG5cdFx0XHRbXCJFTkRMXCIsIEVPTF1cclxuXHRcdF0pO1xyXG5cdFx0cmVhZG9ubHkgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gWyBdO1xyXG5cclxuXHRcdHByb3RlY3RlZCByZWFkb25seSBpc0FzeW5jOiBib29sZWFuID0gZmFsc2U7XHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbmFtZTogc3RyaW5nID0gXCJfX0JBU0VfX1wiO1xyXG5cdFx0cmVhZG9ubHkgX3N0cmVhbXM6IHtcclxuXHRcdFx0aW5wdXQ6IE5vZGVKUy5SZWFkU3RyZWFtLFxyXG5cdFx0XHRvdXRwdXQ6IE5vZGVKUy5Xcml0ZVN0cmVhbSxcclxuXHRcdFx0ZXJyb3I6IE5vZGVKUy5Xcml0ZVN0cmVhbVxyXG5cdFx0fSA9IHtcclxuXHRcdFx0aW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcblx0XHRcdG91dHB1dDogcHJvY2Vzcy5zdGRvdXQsXHJcblx0XHRcdGVycm9yOiBwcm9jZXNzLnN0ZGVyclxyXG5cdFx0fTtcclxuXHJcblx0XHRjb25zdHJ1Y3RvcihuYW1lPzogc3RyaW5nLCBpc0FzeW5jPzogYm9vbGVhbikge1xyXG5cdFx0XHRzdXBlcigpO1xyXG5cdFx0XHR0aGlzLm5hbWUgPSBuYW1lIHx8IHRoaXMubmFtZTtcclxuXHRcdFx0dGhpcy5pc0FzeW5jID0gaXNBc3luYyB8fCB0aGlzLmlzQXN5bmM7XHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8dm9pZD4ge1xyXG5cdFx0XHRmb3IgKDsgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpIDwgdGhpcy5pbnN0cnVjdGlvbnMubGVuZ3RoOyB0aGlzLnJlZ2lzdGVycy5zZXQoXCJqbXhcIiwgdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpICsgMSkpIHtcclxuXHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5pbnN0cnVjdGlvbnNbdGhpcy5yZWdpc3RlcnMuZ2V0KFwiam14XCIpXS5jYWxsKCkpIGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdHByb3RlY3RlZCBhZGQoaW5zdDogSW5zdHJ1Y3Rpb24gfCBzdHJpbmcpOiBJbnN0cnVjdGlvbiB8IHN0cmluZyB7XHJcblx0XHRcdGlmICh0eXBlb2YgaW5zdCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdGlmIChpbnN0ID09PSAnJykgcmV0dXJuIGluc3Q7XHJcblxyXG5cdFx0XHRcdGluc3QgPSBJbnN0cnVjdGlvbi5wYXJzZShpbnN0LCB0aGlzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5pbnN0cnVjdGlvbnMucHVzaChpbnN0KTtcclxuXHJcblx0XHRcdHJldHVybiBpbnN0O1xyXG5cdFx0fSAvL2FkZFxyXG5cclxuXHRcdHB1YmxpYyBnZXRSZWcocmVnOiBzdHJpbmcpOiBhbnkge1xyXG5cdFx0XHRpZiAoY29uZmlnLmluZGV4LnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGlmIChyZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKSkge1xyXG5cdFx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLmluZGV4KTtcclxuXHJcblx0XHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0bGV0IHQ6IHN0cmluZyA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKTtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dCAqIDEpID09PSBmYWxzZSkgdCAqPSAxO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHQgPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0UmVnKHJlZylbdF07XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5zdHIudGVzdCh0KSkgeyAgLy9EP1xyXG5cdFx0XHRcdFx0XHR0ID0gdC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIik7ICAvL3doeSBub3QgdXNlIC5wcm9wIHN5bnRheCBpbnN0ZWFkP1xyXG5cdFx0XHRcdFx0XHRsZXQgcmV0OiBhbnkgPSB0aGlzLmdldFJlZyhyZWcpO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuIChyZXQgaW5zdGFuY2VvZiBTY29wZSkgPyByZXQuZ2V0UmVnKHQpIDogcmV0W3RdO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0UmVnKHJlZylbdGhpcy5nZXRSZWcodCldO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gcmVnLnJlcGxhY2UoY29uZmlnLmluZGV4LCBcIiQxXCIpLnNwbGl0KGNvbmZpZy5hcnJheXNlcCkubWFwKChjaHVuazogc3RyaW5nKSA9PiB7XHJcblx0XHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj5jaHVuayAqIDEpID09PSBmYWxzZSkgY2h1bmsgKj0gMTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGNodW5rO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbmZpZy5wcm9wLnRlc3QocmVnKSkge1xyXG5cdFx0XHRcdGxldCBtYXQ6IHN0cmluZ1tdID0gcmVnLm1hdGNoKGNvbmZpZy5wcm9wKTtcclxuXHJcblx0XHRcdFx0cmVnID0gcmVnLnJlcGxhY2UoY29uZmlnLnByb3AsICcnKTtcclxuXHJcblx0XHRcdFx0bGV0IHJldDogYW55ID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHJcblx0XHRcdFx0bGV0IHQ6IHN0cmluZyA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5wcm9wLCBcIiQxXCIpO1xyXG5cclxuXHRcdFx0XHRyZXR1cm4gKHJldCBpbnN0YW5jZW9mIFNjb3BlKSA/IHJldC5nZXRSZWcodCkgOiByZXRbdF07XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnN0ci50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRyZXR1cm4gcmVnLnJlcGxhY2UoY29uZmlnLnN0ciwgXCIkMVwiKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRoaXMucmVnaXN0ZXJzLmhhcyhyZWcpID8gdGhpcy5yZWdpc3RlcnMuZ2V0KHJlZykgOiAodGhpcy5zY29wZXMuaGFzKHJlZykgPyB0aGlzLnNjb3Blcy5nZXQocmVnKSA6IDApO1xyXG5cdFx0fSAvL2dldFJlZ1xyXG5cclxuXHRcdHB1YmxpYyBzZXRSZWcocmVnOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBNYXA8c3RyaW5nLCBhbnk+IHtcclxuXHRcdFx0aWYgKGNvbmZpZy5pbmRleC50ZXN0KHJlZykpIHtcclxuXHRcdFx0XHRpZiAocmVnLnJlcGxhY2UoY29uZmlnLmluZGV4LCAnJykpIHtcclxuXHRcdFx0XHRcdGxldCBtYXQ6IHN0cmluZ1tdID0gcmVnLm1hdGNoKGNvbmZpZy5pbmRleCk7XHJcblx0XHRcdFx0XHRyZWcgPSByZWcucmVwbGFjZShjb25maWcuaW5kZXgsICcnKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgdCA9IG1hdFswXS5yZXBsYWNlKGNvbmZpZy5pbmRleCwgXCIkMVwiKSxcclxuXHRcdFx0XHRcdFx0dG1wID0gdGhpcy5nZXRSZWcocmVnKTtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dCAqIDEpID09PSBmYWxzZSkgdCAqPSAxO1xyXG5cclxuXHRcdFx0XHRcdGlmICh0eXBlb2YgdCA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdG1wLnNldFJlZyh0LCB2YWx1ZSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dG1wW3RdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjb25maWcuc3RyLnRlc3QodCkpIHsgIC8vRD9cclxuXHRcdFx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIiksIHZhbHVlKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0bXBbdC5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIildID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0aWYgKHRtcCBpbnN0YW5jZW9mIFNjb3BlKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRtcC5zZXRSZWcodGhpcy5nZXRSZWcodCksIHZhbHVlKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0bXBbdGhpcy5nZXRSZWcodCldID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UmVnKHJlZywgdG1wKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aHJvdyBKU0FFcnJvcnMuRUJBRFNZTjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLnByb3AudGVzdChyZWcpKSB7XHJcblx0XHRcdFx0bGV0IG1hdDogc3RyaW5nW10gPSByZWcubWF0Y2goY29uZmlnLnByb3ApO1xyXG5cdFx0XHRcdHJlZyA9IHJlZy5yZXBsYWNlKGNvbmZpZy5wcm9wLCAnJyk7XHJcblxyXG5cdFx0XHRcdGxldCB0ID0gbWF0WzBdLnJlcGxhY2UoY29uZmlnLnByb3AsIFwiJDFcIiksXHJcblx0XHRcdFx0XHR0bXAgPSB0aGlzLmdldFJlZyhyZWcpO1xyXG5cclxuXHRcdFx0XHRpZiAodG1wIGluc3RhbmNlb2YgU2NvcGUpIHtcclxuXHRcdFx0XHRcdHJldHVybiB0bXAuc2V0UmVnKHQsIHZhbHVlKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dG1wW3RdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRSZWcocmVnLCB0bXApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRoaXMucmVnaXN0ZXJzLnNldChyZWcsIHZhbHVlKTtcclxuXHRcdH0gLy9zZXRSZWdcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIGxvYWQoY29kZTogc3RyaW5nLCBuYW1lPzogc3RyaW5nLCBpc0FzeW5jPzogYm9vbGVhbik6IFNjb3BlIHsgIC8vcGFzcyBzY29wZSBib2R5IGFzIHN0cmluZ1xyXG5cdFx0XHRjb2RlID0gYCR7Y29uZmlnLnN0YXJ0c21ibH0ke2NvbmZpZy5qbXBsYWJ9JHtjb25maWcuZW5kbC5yZXBlYXQoMil9JHtjb2RlfSR7Y29uZmlnLmVuZGwucmVwZWF0KDIpfSR7Y29uZmlnLmVuZHNtYmx9JHtjb25maWcuam1wbGFifSR7Y29uZmlnLmVuZGx9YDtcclxuXHJcblx0XHRcdGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoY29uZmlnLmVuZGxfciksXHJcblx0XHRcdFx0c3Vic2NvcGU6IG51bWJlciA9IC0xLFxyXG5cdFx0XHRcdG5zY29wZTogc3RyaW5nID0gJycsXHJcblx0XHRcdFx0bnNjb3BlbmFtZTogc3RyaW5nID0gJycsXHJcblx0XHRcdFx0bnNjb3BlYXN5bmM6IGJvb2xlYW4sXHJcblx0XHRcdFx0c2NvcGU6IFNjb3BlID0gbmV3IFNjb3BlKG5hbWUsIGlzQXN5bmMpLFxyXG5cdFx0XHRcdGxuY250OiBudW1iZXIgPSAwO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgbGluZSBvZiBsaW5lcykge1xyXG5cdFx0XHRcdGxpbmUgPSBsaW5lLnJlcGxhY2UoY29uZmlnLmNvbW1lbnQsICcnKS50cmltKCk7XHJcblxyXG5cdFx0XHRcdGlmIChzdWJzY29wZSA9PT0gLTEgJiYgY29uZmlnLmlzU2NvcGUudGVzdChsaW5lKSkge1xyXG5cdFx0XHRcdFx0c3Vic2NvcGUrKztcclxuXHJcblx0XHRcdFx0XHRsZXQgcGFydHM6IHN0cmluZ1tdID0gbGluZS5zcGxpdChjb25maWcuc2VwX3IpO1xyXG5cclxuXHRcdFx0XHRcdGlmIChwYXJ0cy5sZW5ndGggPiAzKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTWU4sIGBUb28gbWFueSBwYXJhbWV0ZXJzIG9uIGRlY2xhcmF0aW9uLCBuZWVkIGF0IG1vc3QgMy4gKCR7bG5jbnR9KSR7RU9MfSR7bGluZX1gKTtcclxuXHRcdFx0XHRcdGlmIChwYXJ0cy5sZW5ndGggPCAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURTWU4sIGBUb28gbGl0dGxlIHBhcmFtZXRlcnMgb24gZGVjbGFyYXRpb24sIG5lZWQgYXQgbGVhc3QgMi4gKCR7bG5jbnR9KSR7RU9MfSR7bGluZX1gKTtcclxuXHRcdFx0XHRcdGlmIChwYXJ0cy5sZW5ndGggPT09IDMgJiYgY29uZmlnLmFzbiAhPT0gcGFydHNbMF0pIHRocm93cyhKU0FFcnJvcnMuRUJBRFNZTiwgYEZpcnN0IHBhcmFtZXRlciBtdXN0IGJlICdhc24nLCBzZWNvbmQgJ2RlZicgYW5kIHRoaXJkIHRoZSBuYW1lLiAoJHtsbmNudH0pJHtFT0x9JHtsaW5lfWApO1xyXG5cdFx0XHRcdFx0aWYgKHBhcnRzLmxlbmd0aCA9PT0gMykgbnNjb3BlYXN5bmMgPSB0cnVlO1xyXG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5pc1Njb3BlLnRlc3QobnNjb3BlbmFtZSA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdKSkgdGhyb3dzKEpTQUVycm9ycy5FQkFETik7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChzdWJzY29wZSA+IC0xICYmIGNvbmZpZy5pc1Njb3BlRW5kICE9PSBsaW5lKSB7XHJcblx0XHRcdFx0XHRuc2NvcGUgKz0gbGluZSArIGNvbmZpZy5lbmRsO1xyXG5cclxuXHRcdFx0XHRcdGlmIChjb25maWcuaXNTY29wZS50ZXN0KGxpbmUpKSBzdWJzY29wZSsrO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoc3Vic2NvcGUgPiAtMSkge1xyXG5cdFx0XHRcdFx0aWYgKC0tc3Vic2NvcGUgPT09IC0xKSB7XHJcblx0XHRcdFx0XHRcdHNjb3BlLnNjb3Blcy5zZXQobnNjb3BlbmFtZSwgU2NvcGUubG9hZChuc2NvcGUsIG5zY29wZW5hbWUsIG5zY29wZWFzeW5jKSk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlIDwgLTEpIHtcclxuXHRcdFx0XHRcdFx0dGhyb3dzKEpTQUVycm9ycy5FQkFEUywgbGluZSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRuc2NvcGUgKz0gbGluZSArIGNvbmZpZy5lbmRsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGVFbmQgPT09IGxpbmUpIHRocm93cyhKU0FFcnJvcnMuRUJBRFMsIGxpbmUpO1xyXG5cclxuXHRcdFx0XHRcdHNjb3BlLmFkZChsaW5lKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxuY250Kys7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChzdWJzY29wZSAhPT0gLTEpIHRocm93cyhKU0FFcnJvcnMuRUJBRFMpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNjb3BlO1xyXG5cdFx0fSAvL2xvYWRcclxuXHJcblx0fSAvL1Njb3BlXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBJbnN0cnVjdGlvbiB7XHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3BhcmFtczogc3RyaW5nW107XHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBtYXBwaW5nczogTWFwPFJlZ0V4cCwgdHlwZW9mIEluc3RydWN0aW9uPjtcclxuXHJcblx0XHRwcm90ZWN0ZWQgY29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwcm90ZWN0ZWQgcmVhZG9ubHkgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHR0aGlzLl9wYXJhbXMgPSBpbnN0LnNwbGl0KGNvbmZpZy5zZXBfcikubWFwKHBhcnQgPT4gcGFydC5yZXBsYWNlKGNvbmZpZy5lc2NzLCAnJykpO1xyXG5cdFx0fSAvL2N0b3JcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIHBhcnNlKGxpbmU6IHN0cmluZywgcGFyZW50OiBTY29wZSk6IEluc3RydWN0aW9uIHtcclxuXHRcdFx0bGV0IGluczogW1JlZ0V4cCwgdHlwZW9mIEluc3RydWN0aW9uXTtcclxuXHJcblx0XHRcdGlmICgoaW5zID0gQXJyYXkuZnJvbShJbnN0cnVjdGlvbi5tYXBwaW5ncy5lbnRyaWVzKCkpLmZpbmQoKGFycik6IGJvb2xlYW4gPT4gYXJyWzBdLnRlc3QobGluZSkpKSAmJiBpbnNbMV0pIHtcclxuXHRcdFx0XHRyZXR1cm4gbmV3IChpbnNbMV0pKGxpbmUsIHBhcmVudCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBJbnN0cnVjdGlvbihsaW5lLCBwYXJlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9IC8vcGFyc2VcclxuXHJcblx0XHQvL0BPdmVycmlkZVxyXG5cdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdHJldHVybiB0aHJvd3MoSlNBRXJyb3JzLkVJTlNOT1RFWCwgYCR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHR9IC8vSW5zdHJ1Y3Rpb25cclxuXHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgSW5zdHJ1Y3Rpb25zIHtcclxuXHRcdGV4cG9ydCBjbGFzcyBBZGQgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBudW06IG51bWJlciB8IHN0cmluZyA9IDE7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA+IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBtb3N0IDEsIHRoZSB2YWx1ZSR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdHRoaXMubnVtID0gdGhpcy5fcGFyYW1zWzFdIHx8IHRoaXMubnVtO1xyXG5cdFx0XHRcdGlmIChpc05hTig8bnVtYmVyPjx1bmtub3duPnRoaXMubnVtICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMubnVtICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSArIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSArIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9BZGRcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgU3ViIGV4dGVuZHMgQWRkIHtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pIC0gdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pIC0gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL1N1YlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNdWwgZXh0ZW5kcyBBZGQge1xyXG5cclxuXHRcdFx0Ly9AT3ZlcnJpZGVcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG51bTogbnVtYmVyIHwgc3RyaW5nID0gMjtcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMubnVtID09PSBcIm51bWJlclwiKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICogdGhpcy5udW0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcodGhpcy50bywgdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMudG8pICogdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMubnVtKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL011bFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBEaXYgZXh0ZW5kcyBNdWwge1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHRcdHB1YmxpYyBhc3luYyBjYWxsKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgdGhpcy5udW0gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLyB0aGlzLm51bSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykgLyB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5udW0pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vRGl2XHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIE1vZCBleHRlbmRzIERpdiB7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLm51bSA9PT0gXCJudW1iZXJcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAlIHRoaXMubnVtKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSAlIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLm51bSkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9Nb2RcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTW92IGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGZyb206IG51bWJlciB8IHN0cmluZyB8IEFycmF5PGFueT4gPSAwO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdG86IHN0cmluZyA9IFwiYWNjXCI7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA8IDIpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYFBhcmFtZXRlcnMgbXVzdCBiZSBhdCBsZWFzdCAxLCB0aGUgdmFsdWUke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMykgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMiwgdGhlIGFkZHJlc3MgYW5kIHRoZSB2YWx1ZSR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID09PSAzKSB7XHJcblx0XHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdFx0dGhpcy5mcm9tID0gdGhpcy5fcGFyYW1zWzJdO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLmZyb20gPSB0aGlzLl9wYXJhbXNbMV07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLmZyb20gKiAxKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0XHRcdFx0dGhpcy5mcm9tICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLmZyb20gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyh0aGlzLnRvLCB0aGlzLmZyb20pO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuZnJvbSA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKHRoaXMudG8sIHRoaXMucGFyZW50LmdldFJlZyh0aGlzLmZyb20pKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vTW92XHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIFNscCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBpbnRlcnZhbDogbnVtYmVyIHwgc3RyaW5nID0gMTtcclxuXHRcdFx0XHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID4gMikgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IG1vc3QgMSwgdGhlIGludGVydmFsJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0dGhpcy5pbnRlcnZhbCA9IHRoaXMuX3BhcmFtc1sxXTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy5pbnRlcnZhbCAqIDEpID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0Ly9AdHMtaWdub3JlXHJcblx0XHRcdFx0XHR0aGlzLmludGVydmFsICo9IDE7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IC8vY3RvclxyXG5cclxuXHRcdFx0cHVibGljIGFzeW5jIGNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcblx0XHRcdFx0bGV0IGludHJ2OiBudW1iZXIgPSAxO1xyXG5cclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMuaW50ZXJ2YWwgPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRcdGludHJ2ID0gdGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuaW50ZXJ2YWwpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpbnRydiA9IHRoaXMuaW50ZXJ2YWw7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKChyZXM6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZCwgcmVqPzogRXJyb3IpID0+IHNldFRpbWVvdXQocmVzLCBpbnRydikpLmJpbmQodGhpcykpO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9TbHBcclxuXHJcblx0XHRleHBvcnQgY2xhc3MgTGFiZWwgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRwdWJsaWMgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggIT09IDEpIHRocm93cyhKU0FFcnJvcnMuRUJBRENBTCwgYE11c3QgZm9sbG93IHRoZSBmb3JtYXQgJ2xhYmVsJHtjb25maWcuam1wbGFifScke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wYXJhbXNbMF07XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL0xhYmVsXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIEptcCBleHRlbmRzIEluc3RydWN0aW9uIHtcclxuXHJcblx0XHRcdHByb3RlY3RlZCB0bzogc3RyaW5nIHwgbnVtYmVyO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAyKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAxLCB0aGUgbGFiZWwke0VPTH0ke3RoaXMuX3BhcmFtcy5qb2luKGNvbmZpZy5zZXApfWApO1xyXG5cclxuXHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNOYU4oPG51bWJlcj48dW5rbm93bj50aGlzLnRvICogMSkgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMudG8gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMudG8gPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnRvLmVuZHNXaXRoKGNvbmZpZy5qbXBsYWIpKSB7XHJcblx0XHRcdFx0XHRcdGxldCB0bXA6IG51bWJlciA9IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5maW5kSW5kZXgoKGluczogSW5zdHJ1Y3Rpb24pOiBib29sZWFuID0+IChpbnMgaW5zdGFuY2VvZiBMYWJlbCkgJiYgaW5zLm5hbWUgPT09IHRoaXMudG8pOyAgLy9maXJzdC10aW1lLWluaXRpYWxpemF0aW9uIGhhcHBlbnMgdXBvbiBleGVjdXRpb24gdG8gZW5zdXJlIGxhYmVscyBhbGwgZXhpc3RcclxuXHJcblx0XHRcdFx0XHRcdGlmICh0bXAgPCAwKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURKTVAsIGBMYWJlbCAke3RoaXMudG99IGRvZXMgbm90IGV4aXN0LmApO1xyXG5cclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuc2V0UmVnKFwiam1iXCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSk7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnRvID0gdG1wKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGxldCBsYWI6IHN0cmluZyA9IHRoaXMucGFyZW50LnJlZ2lzdGVycy5oYXMoPHN0cmluZz48dW5rbm93bj50aGlzLnRvKSA/IHRoaXMucGFyZW50LmdldFJlZyg8c3RyaW5nPjx1bmtub3duPnRoaXMudG8pIDogKGNvbmZpZy5zdGFydHNtYmwgKyBjb25maWcuam1wbGFiKSxcclxuXHRcdFx0XHRcdFx0XHR0bXA6IG51bWJlciA9IHRoaXMucGFyZW50Lmluc3RydWN0aW9ucy5maW5kSW5kZXgoKGluczogSW5zdHJ1Y3Rpb24pOiBib29sZWFuID0+IChpbnMgaW5zdGFuY2VvZiBMYWJlbCkgJiYgaW5zLm5hbWUgPT09IGxhYik7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodG1wIDwgMCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgTGFiZWwgJHt0aGlzLnRvfSBkb2VzIG5vdCBleGlzdC5gKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImptYlwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdG1wKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMudG8gPCAwIHx8IHRoaXMudG8gPj0gdGhpcy5wYXJlbnQuaW5zdHJ1Y3Rpb25zLmxlbmd0aCkgdGhyb3dzKEpTQUVycm9ycy5FQkFESk1QLCBgSW52YWxpZCBqdW1wIHRvICR7dGhpcy50b31gKTtcclxuXHJcblx0XHRcdFx0XHR0aGlzLnBhcmVudC5zZXRSZWcoXCJqbWJcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpKTtcclxuXHRcdFx0XHRcdHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnRvKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSAvL2NhbGxcclxuXHJcblx0XHR9IC8vSm1wXHJcblxyXG5cdFx0ZXhwb3J0IGNsYXNzIElmIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBlcTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZnJvbTogc3RyaW5nID0gXCJhY2NcIjtcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvOiBzdHJpbmcgfCBudW1iZXIgPSAwO1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtcy5sZW5ndGggPiAzKSB0aHJvd3MoSlNBRXJyb3JzLkVCQURDQUwsIGBQYXJhbWV0ZXJzIG11c3QgYmUgYXQgbW9zdCAyLCB0aGUgYWRkcmVzcyBhbmQgdGhlIHZhbHVlJHtFT0x9JHt0aGlzLl9wYXJhbXMuam9pbihjb25maWcuc2VwKX1gKTtcclxuXHJcblx0XHRcdFx0aWYgKHRoaXMuX3BhcmFtc1swXS5lbmRzV2l0aCgnZScpKSB7XHJcblx0XHRcdFx0XHR0aGlzLmVxID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJhbXMubGVuZ3RoID09PSAzKSB7XHJcblx0XHRcdFx0XHR0aGlzLmZyb20gPSB0aGlzLl9wYXJhbXNbMV07XHJcblx0XHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzJdO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnRvID0gdGhpcy5fcGFyYW1zWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGlzTmFOKDxudW1iZXI+PHVua25vd24+dGhpcy50bykgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0XHQvL0B0cy1pZ25vcmVcclxuXHRcdFx0XHRcdHRoaXMudG8gKj0gMTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHRoaXMudG8gPT09IFwibnVtYmVyXCIpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLmVxKSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSAhPSB0aGlzLnRvKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5wYXJlbnQuZ2V0UmVnKHRoaXMuZnJvbSkgPCB0aGlzLnRvKSB0aGlzLnBhcmVudC5zZXRSZWcoXCJqbXhcIiwgdGhpcy5wYXJlbnQuZ2V0UmVnKFwiam14XCIpICsgMSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLmVxKSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSA9PSB0aGlzLnBhcmVudC5nZXRSZWcodGhpcy50bykpIHRoaXMucGFyZW50LnNldFJlZyhcImpteFwiLCB0aGlzLnBhcmVudC5nZXRSZWcoXCJqbXhcIikgKyAxKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICh0aGlzLnBhcmVudC5nZXRSZWcodGhpcy5mcm9tKSA8IHRoaXMucGFyZW50LmdldFJlZyh0aGlzLnRvKSkgdGhpcy5wYXJlbnQuc2V0UmVnKFwiam14XCIsIHRoaXMucGFyZW50LmdldFJlZyhcImpteFwiKSArIDEpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9JZlxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBQcnQgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblxyXG5cdFx0XHRjb25zdHJ1Y3RvcihpbnN0OiBzdHJpbmcsIHBhcmVudDogU2NvcGUpIHtcclxuXHRcdFx0XHRzdXBlcihpbnN0LCBwYXJlbnQpO1xyXG5cclxuXHRcdFx0XHRpZiAodGhpcy5fcGFyYW1zLmxlbmd0aCA9PT0gMSkgdGhyb3dzKEpTQUVycm9ycy5FQkFEQ0FMLCBgUGFyYW1ldGVycyBtdXN0IGJlIGF0IGxlYXN0IDEsIHRoZSB2YWx1ZSR7RU9MfSR7dGhpcy5fcGFyYW1zLmpvaW4oY29uZmlnLnNlcCl9YCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHRcdFx0XHRsZXQgcHJlYzogc3RyaW5nW10gPSB0aGlzLl9wYXJhbXMuc2xpY2UoMSk7XHJcblxyXG5cdFx0XHRcdGZvciAobGV0IHBhcmFtIG9mIHByZWMpIHtcclxuXHRcdFx0XHRcdGlmIChjb25maWcuc3RyLnRlc3QocGFyYW0pKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGFyZW50Ll9zdHJlYW1zLm91dHB1dC53cml0ZShwYXJhbS5yZXBsYWNlKGNvbmZpZy5zdHIsIFwiJDFcIikpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wYXJlbnQuX3N0cmVhbXMub3V0cHV0LndyaXRlKHRoaXMucGFyZW50LmdldFJlZyhwYXJhbSkgKyAnJyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0gLy9jYWxsXHJcblxyXG5cdFx0fSAvL1BydFxyXG5cclxuXHRcdGV4cG9ydCBjbGFzcyBNZXRob2QgZXh0ZW5kcyBJbnN0cnVjdGlvbiB7XHJcblx0XHRcdC8vY3JlYXRlcyBzY29wZXMgb25seSFcclxuXHJcblx0XHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHRcdHN1cGVyKGluc3QsIHBhcmVudCk7XHJcblx0XHRcdH0gLy9jdG9yXHJcblxyXG5cdFx0XHRwdWJsaWMgYXN5bmMgY2FsbCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdH0gLy9NZXRob2RcclxuXHRcdFxyXG5cdH0gLy9JbnN0cnVjdGlvbnNcclxuXHJcblx0SW5zdHJ1Y3Rpb24ubWFwcGluZ3MgPSBuZXcgTWFwKFtcclxuXHRcdFsvXmFkZCggLispPyQvLCBJbnN0cnVjdGlvbnNbXCJBZGRcIl1dLFxyXG5cdFx0Wy9ec3ViKCAuKyk/JC8sIEluc3RydWN0aW9uc1tcIlN1YlwiXV0sICAvL0RcclxuXHRcdFsvXm11bCAoLispJC8sIEluc3RydWN0aW9uc1tcIk11bFwiXV0sXHJcblx0XHRbL15kaXYgKC4rKSQvLCBJbnN0cnVjdGlvbnNbXCJEaXZcIl1dLCAgLy9EXHJcblx0XHRbL15tb2QoIC4rKT8kLywgSW5zdHJ1Y3Rpb25zW1wiTW9kXCJdXSwgIC8vRD9cclxuXHRcdFsvXm1vdiAoLispezEsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiTW92XCJdXSxcclxuXHRcdFsvXnNscCggLispPyQvLCBJbnN0cnVjdGlvbnNbXCJTbHBcIl1dLFxyXG5cdFx0Wy9eam1wICguKykkLywgSW5zdHJ1Y3Rpb25zW1wiSm1wXCJdXSxcclxuXHRcdFsvXmluYyAoLispezEsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSW5jXCJdXSwgIC8vSU1QTFxyXG5cdFx0Wy9eaWYoZXxsKSggLispezAsMn0kLywgSW5zdHJ1Y3Rpb25zW1wiSWZcIl1dLFxyXG5cdFx0Wy9ecHJ0ICguKykkLywgSW5zdHJ1Y3Rpb25zW1wiUHJ0XCJdXSwgIC8vSU1QTFxyXG5cdFx0Wy9eKC4rKTokLywgSW5zdHJ1Y3Rpb25zW1wiTGFiZWxcIl1dLFxyXG5cdFx0Wy9eLi8sIEluc3RydWN0aW9uW1wiTWV0aG9kXCJdXSAgLy9tZXRob2QgY2FsbCArW2F3XVxyXG5cdF0pO1xyXG5cclxuXHJcblx0ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWQoZmlsZTogc3RyaW5nKTogUHJvbWlzZTxTY29wZT4ge1xyXG5cdFx0aWYgKGV4dG5hbWUoZmlsZSkgPT09ICcnKSBmaWxlICs9IGNvbmZpZy5leHRuYW1lO1xyXG5cclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzOiAodmFsdWU6IFNjb3BlKSA9PiB2b2lkLCByZWo6IChlcnI6IEVycm9yKSA9PiB2b2lkKSA9PiB7XHJcblx0XHRcdGZzLnJlYWRGaWxlKGZpbGUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcclxuXHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRyZWooZXJyKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVzKFNjb3BlLmxvYWQoZGF0YS50b1N0cmluZygpKSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0gLy9sb2FkXHJcblxyXG5cdGZ1bmN0aW9uIHRocm93cyhlcnI6IEVycm9yLCBtZXNzYWdlPzogc3RyaW5nKTogbmV2ZXIge1xyXG5cdFx0aWYgKG1lc3NhZ2UpIGVyci5tZXNzYWdlICs9IEVPTC5yZXBlYXQoMikgKyBtZXNzYWdlO1xyXG5cclxuXHRcdHRocm93IGVycjtcclxuXHR9IC8vdGhyb3dzXHJcblxyXG59IC8vSlNBXHJcblxyXG5leHBvcnQgZGVmYXVsdCBKU0E7XHJcbiJdfQ==