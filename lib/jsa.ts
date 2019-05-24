"use strict";

import * as fs from "fs-extra";
import { EOL } from "os";
import { EventEmitter } from "events";
import { extname } from "path";

export module JSA {

	export namespace config {
		export var extname: string = ".jsa";
		export var endl: string = EOL;
		export var sep: string = ' ';

		export var modifiers: RegExp = /^(asn|ext)$/gmis;
		export var isScope: RegExp = /^(asn |ext )?de(c|f)/gmis;
		export var isScopeEnd: RegExp = /^end/gmis;
	} //config

	export namespace JSAErrors {
		export const EBADN = new SyntaxError("Bad Name.");
		export const EBADS = new SyntaxError("Bad Scope.");
	} //JSAErrors


	export class Scope extends EventEmitter {

		scopes: Map<string, Scope> = new Map();
		registers = new Map([
			["acc", 0],
			["jmx", -1]
		]);
		instructions: Instruction[] = [ ];

		isNS: boolean = true;  //false for func
		isAsync: boolean = false;  //only for funcs
		name: string = "__BASE__";

		constructor(name?: string, isNS: boolean = true) {
			super();
			this.isNS = isNS;
			this.name = name || this.name;
		} //ctor

		call(...params: any[]) {

		} //call

		add(inst: Instruction | string) {
			if (typeof inst === "string") {
				if (inst.trim() === '') return inst;

				inst = Instruction.parse(inst, this);
			}

			this.instructions.push(inst);

			return inst;
		} //add

		static load(code: string, name?: string, isNS?: boolean): Scope {  //pass scope body as string
			let lines = code.split(config.endl),
				subscope: number = -1,
				nscope: string = '',
				nscopename: string = '',
				nscopens: boolean = false,
				scope = new Scope(name, isNS);

			for (let line of lines) {
				line = line.trim();
				if (subscope === -1 && config.isScope.test(line)) {
					subscope++;

					let parts: string[] = line.split(config.sep);

					if (parts.length > 3) throw JSAErrors.EBADN;
					if (parts.length === 3 && config.modifiers.test(parts[0]) === false) throw JSAErrors.EBADN;
					if (parts[1] === "def" && parts[0] === "ext") throw JSAErrors.EBADN;
					if (parts[1] === "dec" && parts[0] === "asn") throw JSAErrors.EBADN;
					if (config.isScope.test(nscopename = parts[parts.length - 1])) throw JSAErrors.EBADN;
					if (parts[parts.length - 2] === "dec") nscopens = true;
				} else if (subscope > -1 && config.isScopeEnd.test(line) === false) {
					nscope += line + config.endl;

					if (config.isScope.test(line)) subscope++;
				} else if (subscope > -1) {
					if (--subscope === -1) {
						scope.scopes.set(nscopename, Scope.load(nscope, nscopename, nscopens));
					} else if (subscope < -1) {
						throw JSAErrors.EBADS;
					} else {
						nscope += line + config.endl;
					}
				} else {
					if (config.isScopeEnd.test(line)) throw JSAErrors.EBADS;

					scope.add(line);
				}
			}
			
			if (subscope !== -1) throw JSAErrors.EBADS;

			return scope;
		} //load

	} //Scope

	export class Instruction {
		params: string[];
		parent: Scope;

		static mappings: Map<RegExp, typeof Instruction>;

		constructor(inst: string, parent: Scope) {
			this.params = inst.split(config.sep);
			this.parent = parent;
		} //ctor

		static parse(line: string, parent: Scope): Instruction {
			return new Instruction(line, parent);
		} //parse

	} //Instruction


	export namespace Instructions {
		export class Add extends Instruction {

			constructor(inst: string, parent: Scope) {
				super(inst, parent);
			} //ctor

		} //Add
	} //Instructions

	Instruction.mappings = new Map([
		[/^add( .+){0, 2}$/gmis, Instructions["Add"]],
		[/^sub( .+){0, 2}$/gmis, Instructions["Sub"]],
		[/^mul (.+){1, 2}$/gmis, Instructions["Mul"]],
		[/^div (.+){1, 2}$/gmis, Instructions["Div"]],
		[/^mov (.+){1, 2}$/gmis, Instructions["Mov"]],
		[/^moc (.+){1, 2}$/gmis, Instructions["Moc"]],
		[/^jmp (.+)$/gmis, Instructions["Jmp"]],
		[/^inc (.+){1, 2}$/gmis, Instructions["Inc"]],
		[/^slp( .+)?$/gmis, Instructions["Slp"]],
		[/^if(e|l|g|le|ge)( .+){0, 2}$/gmis, Instructions["If"]],
		[/^(.+):$/gmis, Instructions["Label"]]  //method call +[aw]
	]);


	export async function load(file: string): Promise<Scope> {
		if (extname(file) === '') file += config.extname;

		return new Promise((res, rej) => {
			fs.readFile(file, (err, data) => {
				if (err) {
					rej(err);
				} else {
					res(Scope.load(data.toString()));
				}
			});
		});
	} //load

} //JSA

export default JSA;
