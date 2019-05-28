"use strict";

import { readFile } from "fs-extra";
import { EOL } from "os";
import { EventEmitter } from "events";
import { extname, basename } from "path";


//IMPL: objects

export module JSA {

	export namespace config {
		export var extname: string = ".jsa";
		export var jmplab: string = ':';
		export var arraysep: string = ',';
		export var startsmbl: string = "__START_";
		export var endsmbl: string = "__END_";
		export var base: string = "__BASE__";
		export var asn: string = "asn";
		export var aw: string = "aw";
		export var fn: string = "def";
		export var isScopeEnd: string = "end";
		export var sep: string = ' ';
		export var endl: string = EOL;
		export var sep_r: RegExp = /(?<!\\) /gm;
		export var endl_r: RegExp = /(?<!\\)\n/gm;

		//SECOND EXPANSION
		export var isScope: RegExp = new RegExp("^(" + asn + " )?(" + fn + ") ?", '');
		export var comment: RegExp = /#.*$/is
		export var index: RegExp = /\[(.+)\]|\((.+)\)/ms;
		export var str: RegExp = /^['"](.+)['"]$/ms;
		export var prop: RegExp = /\.(.+)$/ms;
		export var escs: RegExp = /(?<!\\)\\/gm
	} //config

	export namespace JSAErrors {
		export const EBADN: SyntaxError = new SyntaxError("Bad Name.");
		export const EBADS: SyntaxError = new SyntaxError("Bad Scope.");
		export const EBADCAL: SyntaxError = new SyntaxError("Bad parameters.");
		export const EBADSYN: SyntaxError = new SyntaxError("Bad Syntax.");
		export const EINSNOTEX: SyntaxError = new SyntaxError("Instruction does not exist.");
		export const EBADJMP: SyntaxError = new SyntaxError("Bad Jump.");
		export const EBADPTH: ReferenceError = new ReferenceError("Bad Path.");
	} //JSAErrors


	export class Scope extends EventEmitter {

		readonly scopes: Map<string, Scope> = new Map<string, Scope>();
		readonly registers: Map<string, any> = new Map<string, any>([
			["acc", 0],
			["jmx", 0],
			["jmb", 0],
			["ENDL", EOL],
			["WSPC", ' '],
			["ARGS", []],  //load from CLI?
			["_math", Math],
			["_date", Date],
			["null", null]
		]);
		readonly instructions: Instruction[] = [ ];

		readonly name: string = config.base;

		@enumerable
		readonly _streams: {
			input: NodeJS.ReadStream,
			output: NodeJS.WriteStream,
			error: NodeJS.WriteStream
		} = {
			input: process.stdin,
			output: process.stdout,
			error: process.stderr
		};

		constructor(name?: string) {
			super();
			this.name = name || this.name;

			this._streams.input.setRawMode(true);
		} //ctor

		public async call(): Promise<void> {
			for (; this.registers.get("jmx") < this.instructions.length; this.registers.set("jmx", this.registers.get("jmx") + 1)) {
				if (await this.instructions[this.registers.get("jmx")].call()) break;
			}
		} //call

		protected add(inst: Instruction | string): Instruction | string {
			if (typeof inst === "string") {
				if (inst === '') return inst;

				inst = Instruction.parse(inst, this);
			}

			this.instructions.push(inst);

			return inst;
		} //add

		public getReg(reg: string): any {
			if (config.index.test(reg)) {
				if (reg.replace(config.index, '')) {
					let mat: string[] = reg.match(config.index);

					reg = reg.replace(config.index, '');
					
					let t: string = mat[0].replace(config.index, "$1");
					//@ts-ignore
					if (isNaN(<number><unknown>t * 1) === false) t *= 1;
					
					if (typeof t === "number") {
						let tmp = this.getReg(reg);
						return typeof tmp[t] === "function" ? tmp[t].bing(tmp) : tmp[t];
					} else if (config.str.test(t)) {  //D?
						t = t.replace(config.str, "$1");  //why not use .prop syntax instead?
						let ret: any = this.getReg(reg),
							tmp = (ret instanceof Scope) ? ret.getReg(t) : ret[t];

						return typeof tmp === "function" ? tmp.bind(ret) : tmp;
					} else {
						let tmp = this.getReg(reg),
								got = tmp[this.getReg(t)];

						return typeof got === "function" ? got.bind(tmp) : got;
					}
				} else {
					return reg.replace(config.index, "$1").split(config.arraysep).map((chunk: string) => {
						//@ts-ignore
						if (isNaN(<number><unknown>chunk * 1) === false) chunk *= 1;
						return chunk;
					});
				}
			} else if (config.prop.test(reg)) {
				let mat: string[] = reg.match(config.prop);

				reg = reg.replace(config.prop, '');

				let ret: any = this.getReg(reg);

				let t: string = mat[0].replace(config.prop, "$1"),
					tmp = (ret instanceof Scope) ? ret.getReg(t) : ret[t];

				return typeof tmp === "function" ? tmp.bind(ret) : tmp;
			} else if (config.str.test(reg)) {
				return reg.replace(config.str, "$1");
			}

			return this.registers.has(reg) ? this.registers.get(reg) : (this.scopes.has(reg) ? this.scopes.get(reg) : 0);
		} //getReg

		public setReg(reg: string, value: any): Map<string, any> {  //for funcs?
			if (config.index.test(reg)) {
				if (reg.replace(config.index, '')) {
					let mat: string[] = reg.match(config.index);
					reg = reg.replace(config.index, '');

					let t = mat[0].replace(config.index, "$1"),
						tmp = this.getReg(reg);
					//@ts-ignore
					if (isNaN(<number><unknown>t * 1) === false) t *= 1;

					if (typeof t === "number") {
						if (tmp instanceof Scope) {
							return tmp.setReg(t, value);
						} else {
							tmp[t] = value;
							return this.setReg(reg, tmp);
						}
					} else if (config.str.test(t)) {  //D?
						if (tmp instanceof Scope) {
							return tmp.setReg(t.replace(config.str, "$1"), value);
						} else {
							tmp[t.replace(config.str, "$1")] = value;
							return this.setReg(reg, tmp);
						}
					} else {
						if (tmp instanceof Scope) {
							return tmp.setReg(this.getReg(t), value);
						} else {
							tmp[this.getReg(t)] = value;
							return this.setReg(reg, tmp);
						}
					}
				} else {
					throw JSAErrors.EBADSYN;
				}
			} else if (config.prop.test(reg)) {
				let mat: string[] = reg.match(config.prop);
				reg = reg.replace(config.prop, '');

				let t = mat[0].replace(config.prop, "$1"),
					tmp = this.getReg(reg);

				if (tmp instanceof Scope) {
					return tmp.setReg(t, value);
				} else {
					tmp[t] = value;
					return this.setReg(reg, tmp);
				}
			}

			return this.registers.set(reg, value);
		} //setReg

		public makeObj(): Scope {
			let nscp: Scope = new Scope();

			Object.assign(nscp, this);
			
			return nscp;
		} //makeObj

		public static load(code: string, name?: string): Scope {  //pass scope body as string
			code = `${config.startsmbl}${config.jmplab}${config.endl.repeat(2)}${code}${config.endl.repeat(2)}${config.endsmbl}${config.jmplab}${config.endl}`;

			let lines = code.split(config.endl_r),
				subscope: number = -1,
				nscope: string = '',
				nscopename: string = '',
				scope: Scope = new Scope(name),
				lncnt: number = 0;

			for (let line of lines) {
				line = line.replace(config.comment, '').trim();

				if (subscope === -1 && config.isScope.test(line)) {
					subscope++;

					let parts: string[] = line.split(config.sep_r);

					if (parts.length > 3) throws(JSAErrors.EBADSYN, `Too many parameters on declaration, need at most 3. (${lncnt})${EOL}${line}`);
					if (parts.length < 2) throws(JSAErrors.EBADSYN, `Too little parameters on declaration, need at least 2. (${lncnt})${EOL}${line}`);
					if (parts.length === 3 && config.asn !== parts[0]) throws(JSAErrors.EBADSYN, `First parameter must be 'asn', second 'def' and third the name. (${lncnt})${EOL}${line}`);
					if (config.isScope.test(nscopename = parts[parts.length - 1])) throws(JSAErrors.EBADN);
				} else if (subscope > -1 && config.isScopeEnd !== line) {
					nscope += line + config.endl;

					if (config.isScope.test(line)) subscope++;
				} else if (subscope > -1) {
					if (--subscope === -1) {
						scope.scopes.set(nscopename, Scope.load(nscope, nscopename));
					} else if (subscope < -1) {
						throws(JSAErrors.EBADS, line);
					} else {
						nscope += line + config.endl;
					}
				} else {
					if (config.isScopeEnd === line) throws(JSAErrors.EBADS, line);

					scope.add(line);
				}

				lncnt++;
			}
			
			if (subscope !== -1) throws(JSAErrors.EBADS);

			return scope;
		} //load

	} //Scope

	export class Instruction {
		protected readonly _params: string[];

		public static mappings: Map<RegExp, typeof Instruction>;

		protected constructor(inst: string, protected readonly parent: Scope) {
			this._params = inst.split(config.sep_r).map(part => part.replace(config.escs, ''));
		} //ctor

		public static parse(line: string, parent: Scope): Instruction {
			let ins: [RegExp, typeof Instruction];

			if ((ins = Array.from(Instruction.mappings.entries()).find((arr): boolean => arr[0].test(line))) && ins[1]) {
				return new (ins[1])(line, parent);
			} else {
				return new Instruction(line, parent);
			}
		} //parse

		//@Override
		public async call(): Promise<boolean> {
			return throws(JSAErrors.EINSNOTEX, `${this._params.join(config.sep)}`);
		} //call

	} //Instruction


	export namespace Instructions {
		export class Add extends Instruction {

			protected readonly to: string = "acc";
			protected readonly num: number | string = 1;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length > 2) throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the value.${EOL}${this._params.join(config.sep)}`);

				this.num = this._params[1] || this.num;
				if (isNaN(<number><unknown>this.num * 1) === false) {
					//@ts-ignore
					this.num *= 1;
				}
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.num === "number") {
					this.parent.setReg(this.to, this.parent.getReg(this.to) + this.num);
				} else {
					this.parent.setReg(this.to, this.parent.getReg(this.to) + this.parent.getReg(this.num));
				}

				return false;
			} //call

		} //Add

		export class Sub extends Add {

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.num === "number") {
					this.parent.setReg(this.to, this.parent.getReg(this.to) - this.num);
				} else {
					this.parent.setReg(this.to, this.parent.getReg(this.to) - this.parent.getReg(this.num));
				}

				return false;
			} //call

		} //Sub

		export class Mul extends Add {

			//@Override
			protected readonly num: number | string = 2;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.num === "number") {
					this.parent.setReg(this.to, this.parent.getReg(this.to) * this.num);
				} else {
					this.parent.setReg(this.to, this.parent.getReg(this.to) * this.parent.getReg(this.num));
				}

				return false;
			} //call

		} //Mul

		export class Div extends Mul {

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.num === "number") {
					this.parent.setReg(this.to, this.parent.getReg(this.to) / this.num);
				} else {
					this.parent.setReg(this.to, this.parent.getReg(this.to) / this.parent.getReg(this.num));
				}

				return false;
			} //call

		} //Div

		export class Mod extends Div {

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.num === "number") {
					this.parent.setReg(this.to, this.parent.getReg(this.to) % this.num);
				} else {
					this.parent.setReg(this.to, this.parent.getReg(this.to) % this.parent.getReg(this.num));
				}

				return false;
			} //call

		} //Mod

		export class Mov extends Instruction {

			protected readonly from: number | string | Array<any> = 0;
			protected readonly to: string = "acc";

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length < 2) throws(JSAErrors.EBADCAL, `Parameters must be at least 1, the value.${EOL}${this._params.join(config.sep)}`);
				if (this._params.length > 3) throws(JSAErrors.EBADCAL, `Parameters must be at most 2, the address and the value.${EOL}${this._params.join(config.sep)}`);

				if (this._params.length === 3) {
					this.to = this._params[1];
					this.from = this._params[2];
				} else {
					this.from = this._params[1];
				}

				if (isNaN(<number><unknown>this.from * 1) === false) {
					//@ts-ignore
					this.from *= 1;
				}
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.from === "number") {
					this.parent.setReg(this.to, this.from);
				} else if (typeof this.from === "string") {
					this.parent.setReg(this.to, this.parent.getReg(this.from));
				}

				return false;
			} //call

		} //Mov

		export class Slp extends Instruction {

			protected readonly interval: number | string = 1;
			
			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length > 2) throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the interval.${EOL}${this._params.join(config.sep)}`);

				this.interval = this._params[1];

				if (isNaN(<number><unknown>this.interval * 1) === false) {
					//@ts-ignore
					this.interval *= 1;
				}
			} //ctor

			public async call(): Promise<boolean> {
				let intrv: number = 1;

				if (typeof this.interval === "string") {
					intrv = this.parent.getReg(this.interval);
				} else {
					intrv = this.interval;
				}

				return new Promise(((res: (value: boolean) => void, rej?: (err: Error) => void) => setTimeout(res, intrv)).bind(this));
			} //call

		} //Slp

		export class Label extends Instruction {

			public readonly name: string;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length !== 1) throws(JSAErrors.EBADCAL, `Must follow the format 'label${config.jmplab}'.${EOL}${this._params.join(config.sep)}`);

				this.name = this._params[0];
			} //ctor

			public async call(): Promise<boolean> {
				return false;
			} //call

		} //Label

		export class Jmp extends Instruction {

			protected to: string | number;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length > 2) throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the label.${EOL}${this._params.join(config.sep)}`);

				this.to = this._params[1];

				if (isNaN(<number><unknown>this.to * 1) === false) {
					//@ts-ignore
					this.to *= 1;
				}
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.to === "string") {
					if (this.to.endsWith(config.jmplab)) {
						let tmp: number = this.parent.instructions.findIndex((ins: Instruction): boolean => (ins instanceof Label) && ins.name === this.to);  //first-time-initialization happens upon execution to ensure labels all exist

						if (tmp < 0) throws(JSAErrors.EBADJMP, `Label ${this.to} does not exist.`);

						this.parent.setReg("jmb", this.parent.getReg("jmx"));
						this.parent.setReg("jmx", this.to = tmp);
					} else {
						let lab: string = this.parent.registers.has(<string><unknown>this.to) ? this.parent.getReg(<string><unknown>this.to) : (config.startsmbl + config.jmplab),
							tmp: number = this.parent.instructions.findIndex((ins: Instruction): boolean => (ins instanceof Label) && ins.name === lab);

						if (tmp < 0) throws(JSAErrors.EBADJMP, `Label ${this.to} does not exist.`);

						this.parent.setReg("jmb", this.parent.getReg("jmx"));
						this.parent.setReg("jmx", tmp);
					}
				} else {
					if (this.to < 0 || this.to >= this.parent.instructions.length) throws(JSAErrors.EBADJMP, `Invalid jump to ${this.to}`);

					this.parent.setReg("jmb", this.parent.getReg("jmx"));
					this.parent.setReg("jmx", this.to);
				}

				return false;
			} //call

		} //Jmp

		export class If extends Instruction {

			private readonly eq: boolean = false;
			protected readonly from: string = "acc";
			protected readonly to: string | number = 0;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length > 2) throws(JSAErrors.EBADCAL, `Parameters must be at most 1, the value.${EOL}${this._params.join(config.sep)}`);

				if (this._params[0].endsWith('e')) {
					this.eq = true;
				}

				this.to = this._params[1] || this.to;

				if (isNaN(<number><unknown>this.to) === false) {
					//@ts-ignore
					this.to *= 1;
				}
			} //ctor

			public async call(): Promise<boolean> {
				if (typeof this.to === "number") {
					if (this.eq) {
						if (this.parent.getReg(this.from) != this.to) this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
					} else {
						if (this.parent.getReg(this.from) < this.to) this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
					}
				} else {
					if (this.eq) {
						if (this.parent.getReg(this.from) == this.parent.getReg(this.to)) this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
					} else {
						if (this.parent.getReg(this.from) < this.parent.getReg(this.to)) this.parent.setReg("jmx", this.parent.getReg("jmx") + 1);
					}
				}

				return false;
			} //call

		} //If

		export class Prt extends Instruction {

			protected readonly default: string = "acc";

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

			public async call(): Promise<boolean> {
				let prec: string[] = this._params.slice(1);

				if (prec.length) {
					for (let param of prec) {
						if (config.str.test(param)) {
							this.parent._streams.output.write(param.replace(config.str, "$1"));
						} else {
							this.parent._streams.output.write(this.parent.getReg(param) + '');
						}
					}
				} else {
					this.parent._streams.output.write(this.parent.getReg(this.default) + '');
				}

				return false;
			} //call

		} //Prt

		export class Inp extends Instruction {

			protected readonly to: string = "acc";

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length !== 1) throws(JSAErrors.EBADCAL, `Parameters must be exactly 0.${EOL}${this._params.join(config.sep)}`);
			} //ctor

			public async call(): Promise<boolean> {
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

		export class Method extends Instruction {
			//creates scopes and calls only!

			protected readonly name: string;
			protected readonly to: string = "acc";
			protected readonly args: string = "ARGS";
			protected readonly isAw: boolean = false;

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params[0] === config.aw) {
					this.isAw = true;
					this.name = this._params[1];
				} else {
					this.name = this._params[0];
				}
			} //ctor

			public async call(): Promise<boolean> {
				let scp: Scope | Function;

				if ((scp = this.parent.getReg(this.name)) instanceof Scope) {
					if (this._params.length > 1) {
						this._params.slice(this.isAw ? 2 : 1).forEach((param: string, idx: number) => {
							(<Scope>scp).setReg(this.args + `[${idx}]`, param);
						});

						if (this.isAw) {
							await scp.call();
						} else {
							setImmediate(scp.call.bind(scp));
						}
					} else {
						this.parent.setReg(this.to, scp.makeObj());
					}
				} else if (typeof scp === "function") {
					let dat: any;

					if (this.isAw) {
						dat = await scp(...this._params.slice(2));
					} else {
						dat = scp(...this._params.slice(1));
					}
					
					this.parent.setReg(this.to, dat);
				} else {
					throws(JSAErrors.EBADS, `${this.name} is not a scope.`);
				}

				return false;
			} //call

		} //Method

		export class Inc extends Instruction {

			protected from: string;
			protected readonly to: string = "acc";

			constructor(inst: string, parent: Scope) {
				super(inst, parent);

				if (this._params.length !== 2) throws(JSAErrors.EBADCAL, `Parameters must be exactly 1, the path.${EOL}${this._params.join(config.sep)}`);

				this.from = this._params[1];
			} //ctor

			public async call(): Promise<boolean> {
				let from: string = this.parent.getReg(this.from);
				if (extname(from) === '') from += config.extname;

				return new Promise((res: (value: boolean) => void, rej: (err: Error) => void) => {
					readFile(from, (err: Error, data: Buffer) => {
						if (err) {
							rej(err);
							throws(JSAErrors.EBADPTH, `${from}`);
						} else {
							let scp: Scope = Scope.load(data.toString(), basename(from, extname(from)));
							scp.setReg("_isMain_", 0);
							this.parent.setReg(this.to, scp);
							this.parent.scopes.set(scp.name, scp);
							res(false);
						}
					});
				});
			} //call

		} //Inc
		
	} //Instructions

	Instruction.mappings = new Map<RegExp, typeof Instruction>([
		[/^add( .+)?$/, Instructions["Add"]],
		[/^sub( .+)?$/, Instructions["Sub"]],  //D
		[/^mul (.+)$/, Instructions["Mul"]],
		[/^div (.+)$/, Instructions["Div"]],  //D
		[/^mod( .+)?$/, Instructions["Mod"]],  //D?
		[/^mov (.+){1,2}$/, Instructions["Mov"]],
		[/^slp( .+)?$/, Instructions["Slp"]],
		[/^jmp (.+)$/, Instructions["Jmp"]],
		[/^if(e|l)( .+){0,2}$/, Instructions["If"]],
		[/^prt( .+)?$/, Instructions["Prt"]],
		[/^inp$/, Instructions["Inp"]],
		[/^inc (.+){1,2}$/, Instructions["Inc"]],  //IMPL
		[/^(.+):$/, Instructions["Label"]],
		[/^./, Instructions["Method"]]
	]);


	export async function load(file: string): Promise<Scope> {
		if (extname(file) === '') file += config.extname;

		return new Promise((res: (value: Scope) => void, rej: (err: Error) => void) => {
			readFile(file, (err: Error, data: Buffer) => {
				if (err) {
					rej(err);
				} else {
					let scp: Scope = Scope.load(data.toString());
					scp.setReg("_isMain_", 1);
					res(scp);
				}
			});
		});
	} //load

	function throws(err: Error, message?: string): never {
		if (message) err.message += EOL.repeat(2) + message;

		throw err;
	} //throws

	//@Decorator
	function enumerable(target: Object, propertyKey: string | symbol): void {
		Object.defineProperty(target, propertyKey,  {
			enumerable: false,
			configurable: true,
			writable: true
		});
	} //enumerable

} //JSA

export default JSA;
