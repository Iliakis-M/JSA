"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
const os_1 = require("os");
const events_1 = require("events");
const path_1 = require("path");
var JSA;
(function (JSA) {
    let config;
    (function (config) {
        config.extname = ".jsa";
        config.endl = os_1.EOL;
        config.sep = ' ';
        config.modifiers = /^(asn|ext)$/gmis;
        config.isScope = /^(asn |ext )?de(c|f)/gmis;
        config.isScopeEnd = /^end/gmis;
    })(config = JSA.config || (JSA.config = {})); //config
    let JSAErrors;
    (function (JSAErrors) {
        JSAErrors.EBADN = new SyntaxError("Bad Name.");
        JSAErrors.EBADS = new SyntaxError("Bad Scope.");
    })(JSAErrors = JSA.JSAErrors || (JSA.JSAErrors = {})); //JSAErrors
    class Scope extends events_1.EventEmitter {
        constructor(name, isNS = true) {
            super();
            this.scopes = new Map();
            this.registers = new Map([
                ["acc", 0],
                ["jmx", -1]
            ]);
            this.instructions = [];
            this.isNS = true; //false for func
            this.isAsync = false; //only for funcs
            this.name = "__BASE__";
            this.isNS = isNS;
            this.name = name || this.name;
        } //ctor
        call(...params) {
        } //call
        add(inst) {
            if (typeof inst === "string") {
                if (inst.trim() === '')
                    return inst;
                inst = Instruction.parse(inst, this);
            }
            this.instructions.push(inst);
            return inst;
        } //add
        static load(code, name, isNS) {
            let lines = code.split(config.endl), subscope = -1, nscope = '', nscopename = '', nscopens = false, scope = new Scope(name, isNS);
            for (let line of lines) {
                line = line.trim();
                if (subscope === -1 && config.isScope.test(line)) {
                    subscope++;
                    let parts = line.split(config.sep);
                    if (parts.length > 3)
                        throw JSAErrors.EBADN;
                    if (parts.length === 3 && config.modifiers.test(parts[0]) === false)
                        throw JSAErrors.EBADN;
                    if (parts[1] === "def" && parts[0] === "ext")
                        throw JSAErrors.EBADN;
                    if (parts[1] === "dec" && parts[0] === "asn")
                        throw JSAErrors.EBADN;
                    if (config.isScope.test(nscopename = parts[parts.length - 1]))
                        throw JSAErrors.EBADN;
                    if (parts[parts.length - 2] === "dec")
                        nscopens = true;
                }
                else if (subscope > -1 && config.isScopeEnd.test(line) === false) {
                    nscope += line + config.endl;
                    if (config.isScope.test(line))
                        subscope++;
                }
                else if (subscope > -1) {
                    if (--subscope === -1) {
                        scope.scopes.set(nscopename, Scope.load(nscope, nscopename, nscopens));
                    }
                    else if (subscope < -1) {
                        throw JSAErrors.EBADS;
                    }
                    else {
                        nscope += line + config.endl;
                    }
                }
                else {
                    if (config.isScopeEnd.test(line))
                        throw JSAErrors.EBADS;
                    scope.add(line);
                }
            }
            if (subscope !== -1)
                throw JSAErrors.EBADS;
            return scope;
        } //load
    } //Scope
    JSA.Scope = Scope;
    class Instruction {
        constructor(inst, parent) {
            this.params = inst.split(config.sep);
            this.parent = parent;
        } //ctor
        static parse(line, parent) {
            return new Instruction(line, parent);
        } //parse
    } //Instruction
    JSA.Instruction = Instruction;
    let Instructions;
    (function (Instructions) {
        class Add extends Instruction {
            constructor(inst, parent) {
                super(inst, parent);
            } //ctor
        } //Add
        Instructions.Add = Add;
    })(Instructions = JSA.Instructions || (JSA.Instructions = {})); //Instructions
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
        [/^(.+):$/gmis, Instructions["Label"]] //method call +[aw]
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
})(JSA = exports.JSA || (exports.JSA = {})); //JSA
exports.default = JSA;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2pzYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7OztBQUViLHFEQUErQjtBQUMvQiwyQkFBeUI7QUFDekIsbUNBQXNDO0FBQ3RDLCtCQUErQjtBQUUvQixJQUFjLEdBQUcsQ0E2SmhCO0FBN0pELFdBQWMsR0FBRztJQUVoQixJQUFpQixNQUFNLENBUXRCO0lBUkQsV0FBaUIsTUFBTTtRQUNYLGNBQU8sR0FBVyxNQUFNLENBQUM7UUFDekIsV0FBSSxHQUFXLFFBQUcsQ0FBQztRQUNuQixVQUFHLEdBQVcsR0FBRyxDQUFDO1FBRWxCLGdCQUFTLEdBQVcsaUJBQWlCLENBQUM7UUFDdEMsY0FBTyxHQUFXLDBCQUEwQixDQUFDO1FBQzdDLGlCQUFVLEdBQVcsVUFBVSxDQUFDO0lBQzVDLENBQUMsRUFSZ0IsTUFBTSxHQUFOLFVBQU0sS0FBTixVQUFNLFFBUXRCLENBQUMsUUFBUTtJQUVWLElBQWlCLFNBQVMsQ0FHekI7SUFIRCxXQUFpQixTQUFTO1FBQ1osZUFBSyxHQUFHLElBQUksV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3JDLGVBQUssR0FBRyxJQUFJLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNwRCxDQUFDLEVBSGdCLFNBQVMsR0FBVCxhQUFTLEtBQVQsYUFBUyxRQUd6QixDQUFDLFdBQVc7SUFHYixNQUFhLEtBQU0sU0FBUSxxQkFBWTtRQWF0QyxZQUFZLElBQWEsRUFBRSxPQUFnQixJQUFJO1lBQzlDLEtBQUssRUFBRSxDQUFDO1lBWlQsV0FBTSxHQUF1QixJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ3ZDLGNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQztnQkFDbkIsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUNWLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ1gsQ0FBQyxDQUFDO1lBQ0gsaUJBQVksR0FBa0IsRUFB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QUFJLENBQUMsQ0FBQztRQUN4RCxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBRSxtQkFBbUI7S0FDM0QsQ0FBQyxDQUFDO0lBR0ksS0FBSyxVQUFVLElBQUksQ0FBQyxJQUFZO1FBQ3RDLElBQUksY0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFBRSxJQUFJLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUVqRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQy9CLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUMvQixJQUFJLEdBQUcsRUFBRTtvQkFDUixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ1Q7cUJBQU07b0JBQ04sR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztpQkFDakM7WUFDRixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLE1BQU07SUFaYyxRQUFJLE9BWXpCLENBQUE7QUFFRixDQUFDLEVBN0phLEdBQUcsR0FBSCxXQUFHLEtBQUgsV0FBRyxRQTZKaEIsQ0FBQyxLQUFLO0FBRVAsa0JBQWUsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnMtZXh0cmFcIjtcclxuaW1wb3J0IHsgRU9MIH0gZnJvbSBcIm9zXCI7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcclxuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gXCJwYXRoXCI7XHJcblxyXG5leHBvcnQgbW9kdWxlIEpTQSB7XHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgY29uZmlnIHtcclxuXHRcdGV4cG9ydCB2YXIgZXh0bmFtZTogc3RyaW5nID0gXCIuanNhXCI7XHJcblx0XHRleHBvcnQgdmFyIGVuZGw6IHN0cmluZyA9IEVPTDtcclxuXHRcdGV4cG9ydCB2YXIgc2VwOiBzdHJpbmcgPSAnICc7XHJcblxyXG5cdFx0ZXhwb3J0IHZhciBtb2RpZmllcnM6IFJlZ0V4cCA9IC9eKGFzbnxleHQpJC9nbWlzO1xyXG5cdFx0ZXhwb3J0IHZhciBpc1Njb3BlOiBSZWdFeHAgPSAvXihhc24gfGV4dCApP2RlKGN8ZikvZ21pcztcclxuXHRcdGV4cG9ydCB2YXIgaXNTY29wZUVuZDogUmVnRXhwID0gL15lbmQvZ21pcztcclxuXHR9IC8vY29uZmlnXHJcblxyXG5cdGV4cG9ydCBuYW1lc3BhY2UgSlNBRXJyb3JzIHtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFETiA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBOYW1lLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEUyA9IG5ldyBTeW50YXhFcnJvcihcIkJhZCBTY29wZS5cIik7XHJcblx0fSAvL0pTQUVycm9yc1xyXG5cclxuXHJcblx0ZXhwb3J0IGNsYXNzIFNjb3BlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0XHRzY29wZXM6IE1hcDxzdHJpbmcsIFNjb3BlPiA9IG5ldyBNYXAoKTtcclxuXHRcdHJlZ2lzdGVycyA9IG5ldyBNYXAoW1xyXG5cdFx0XHRbXCJhY2NcIiwgMF0sXHJcblx0XHRcdFtcImpteFwiLCAtMV1cclxuXHRcdF0pO1xyXG5cdFx0aW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gWyBdO1xyXG5cclxuXHRcdGlzTlM6IGJvb2xlYW4gPSB0cnVlOyAgLy9mYWxzZSBmb3IgZnVuY1xyXG5cdFx0aXNBc3luYzogYm9vbGVhbiA9IGZhbHNlOyAgLy9vbmx5IGZvciBmdW5jc1xyXG5cdFx0bmFtZTogc3RyaW5nID0gXCJfX0JBU0VfX1wiO1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5hbWU/OiBzdHJpbmcsIGlzTlM6IGJvb2xlYW4gPSB0cnVlKSB7XHJcblx0XHRcdHN1cGVyKCk7XHJcblx0XHRcdHRoaXMuaXNOUyA9IGlzTlM7XHJcblx0XHRcdHRoaXMubmFtZSA9IG5hbWUgfHwgdGhpcy5uYW1lO1xyXG5cdFx0fSAvL2N0b3JcclxuXHJcblx0XHRjYWxsKC4uLnBhcmFtczogYW55W10pIHtcclxuXHJcblx0XHR9IC8vY2FsbFxyXG5cclxuXHRcdGFkZChpbnN0OiBJbnN0cnVjdGlvbiB8IHN0cmluZykge1xyXG5cdFx0XHRpZiAodHlwZW9mIGluc3QgPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRpZiAoaW5zdC50cmltKCkgPT09ICcnKSByZXR1cm4gaW5zdDtcclxuXHJcblx0XHRcdFx0aW5zdCA9IEluc3RydWN0aW9uLnBhcnNlKGluc3QsIHRoaXMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmluc3RydWN0aW9ucy5wdXNoKGluc3QpO1xyXG5cclxuXHRcdFx0cmV0dXJuIGluc3Q7XHJcblx0XHR9IC8vYWRkXHJcblxyXG5cdFx0c3RhdGljIGxvYWQoY29kZTogc3RyaW5nLCBuYW1lPzogc3RyaW5nLCBpc05TPzogYm9vbGVhbik6IFNjb3BlIHsgIC8vcGFzcyBzY29wZSBib2R5IGFzIHN0cmluZ1xyXG5cdFx0XHRsZXQgbGluZXMgPSBjb2RlLnNwbGl0KGNvbmZpZy5lbmRsKSxcclxuXHRcdFx0XHRzdWJzY29wZTogbnVtYmVyID0gLTEsXHJcblx0XHRcdFx0bnNjb3BlOiBzdHJpbmcgPSAnJyxcclxuXHRcdFx0XHRuc2NvcGVuYW1lOiBzdHJpbmcgPSAnJyxcclxuXHRcdFx0XHRuc2NvcGVuczogYm9vbGVhbiA9IGZhbHNlLFxyXG5cdFx0XHRcdHNjb3BlID0gbmV3IFNjb3BlKG5hbWUsIGlzTlMpO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgbGluZSBvZiBsaW5lcykge1xyXG5cdFx0XHRcdGxpbmUgPSBsaW5lLnRyaW0oKTtcclxuXHRcdFx0XHRpZiAoc3Vic2NvcGUgPT09IC0xICYmIGNvbmZpZy5pc1Njb3BlLnRlc3QobGluZSkpIHtcclxuXHRcdFx0XHRcdHN1YnNjb3BlKys7XHJcblxyXG5cdFx0XHRcdFx0bGV0IHBhcnRzOiBzdHJpbmdbXSA9IGxpbmUuc3BsaXQoY29uZmlnLnNlcCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHBhcnRzLmxlbmd0aCA+IDMpIHRocm93IEpTQUVycm9ycy5FQkFETjtcclxuXHRcdFx0XHRcdGlmIChwYXJ0cy5sZW5ndGggPT09IDMgJiYgY29uZmlnLm1vZGlmaWVycy50ZXN0KHBhcnRzWzBdKSA9PT0gZmFsc2UpIHRocm93IEpTQUVycm9ycy5FQkFETjtcclxuXHRcdFx0XHRcdGlmIChwYXJ0c1sxXSA9PT0gXCJkZWZcIiAmJiBwYXJ0c1swXSA9PT0gXCJleHRcIikgdGhyb3cgSlNBRXJyb3JzLkVCQUROO1xyXG5cdFx0XHRcdFx0aWYgKHBhcnRzWzFdID09PSBcImRlY1wiICYmIHBhcnRzWzBdID09PSBcImFzblwiKSB0aHJvdyBKU0FFcnJvcnMuRUJBRE47XHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGUudGVzdChuc2NvcGVuYW1lID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0pKSB0aHJvdyBKU0FFcnJvcnMuRUJBRE47XHJcblx0XHRcdFx0XHRpZiAocGFydHNbcGFydHMubGVuZ3RoIC0gMl0gPT09IFwiZGVjXCIpIG5zY29wZW5zID0gdHJ1ZTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHN1YnNjb3BlID4gLTEgJiYgY29uZmlnLmlzU2NvcGVFbmQudGVzdChsaW5lKSA9PT0gZmFsc2UpIHtcclxuXHRcdFx0XHRcdG5zY29wZSArPSBsaW5lICsgY29uZmlnLmVuZGw7XHJcblxyXG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5pc1Njb3BlLnRlc3QobGluZSkpIHN1YnNjb3BlKys7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChzdWJzY29wZSA+IC0xKSB7XHJcblx0XHRcdFx0XHRpZiAoLS1zdWJzY29wZSA9PT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0c2NvcGUuc2NvcGVzLnNldChuc2NvcGVuYW1lLCBTY29wZS5sb2FkKG5zY29wZSwgbnNjb3BlbmFtZSwgbnNjb3BlbnMpKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc3Vic2NvcGUgPCAtMSkge1xyXG5cdFx0XHRcdFx0XHR0aHJvdyBKU0FFcnJvcnMuRUJBRFM7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRuc2NvcGUgKz0gbGluZSArIGNvbmZpZy5lbmRsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoY29uZmlnLmlzU2NvcGVFbmQudGVzdChsaW5lKSkgdGhyb3cgSlNBRXJyb3JzLkVCQURTO1xyXG5cclxuXHRcdFx0XHRcdHNjb3BlLmFkZChsaW5lKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChzdWJzY29wZSAhPT0gLTEpIHRocm93IEpTQUVycm9ycy5FQkFEUztcclxuXHJcblx0XHRcdHJldHVybiBzY29wZTtcclxuXHRcdH0gLy9sb2FkXHJcblxyXG5cdH0gLy9TY29wZVxyXG5cclxuXHRleHBvcnQgY2xhc3MgSW5zdHJ1Y3Rpb24ge1xyXG5cdFx0cGFyYW1zOiBzdHJpbmdbXTtcclxuXHRcdHBhcmVudDogU2NvcGU7XHJcblxyXG5cdFx0c3RhdGljIG1hcHBpbmdzOiBNYXA8UmVnRXhwLCB0eXBlb2YgSW5zdHJ1Y3Rpb24+O1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKGluc3Q6IHN0cmluZywgcGFyZW50OiBTY29wZSkge1xyXG5cdFx0XHR0aGlzLnBhcmFtcyA9IGluc3Quc3BsaXQoY29uZmlnLnNlcCk7XHJcblx0XHRcdHRoaXMucGFyZW50ID0gcGFyZW50O1xyXG5cdFx0fSAvL2N0b3JcclxuXHJcblx0XHRzdGF0aWMgcGFyc2UobGluZTogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKTogSW5zdHJ1Y3Rpb24ge1xyXG5cdFx0XHRyZXR1cm4gbmV3IEluc3RydWN0aW9uKGxpbmUsIHBhcmVudCk7XHJcblx0XHR9IC8vcGFyc2VcclxuXHJcblx0fSAvL0luc3RydWN0aW9uXHJcblxyXG5cclxuXHRleHBvcnQgbmFtZXNwYWNlIEluc3RydWN0aW9ucyB7XHJcblx0XHRleHBvcnQgY2xhc3MgQWRkIGV4dGVuZHMgSW5zdHJ1Y3Rpb24ge1xyXG5cclxuXHRcdFx0Y29uc3RydWN0b3IoaW5zdDogc3RyaW5nLCBwYXJlbnQ6IFNjb3BlKSB7XHJcblx0XHRcdFx0c3VwZXIoaW5zdCwgcGFyZW50KTtcclxuXHRcdFx0fSAvL2N0b3JcclxuXHJcblx0XHR9IC8vQWRkXHJcblx0fSAvL0luc3RydWN0aW9uc1xyXG5cclxuXHRJbnN0cnVjdGlvbi5tYXBwaW5ncyA9IG5ldyBNYXAoW1xyXG5cdFx0Wy9eYWRkKCAuKyl7MCwgMn0kL2dtaXMsIEluc3RydWN0aW9uc1tcIkFkZFwiXV0sXHJcblx0XHRbL15zdWIoIC4rKXswLCAyfSQvZ21pcywgSW5zdHJ1Y3Rpb25zW1wiU3ViXCJdXSxcclxuXHRcdFsvXm11bCAoLispezEsIDJ9JC9nbWlzLCBJbnN0cnVjdGlvbnNbXCJNdWxcIl1dLFxyXG5cdFx0Wy9eZGl2ICguKyl7MSwgMn0kL2dtaXMsIEluc3RydWN0aW9uc1tcIkRpdlwiXV0sXHJcblx0XHRbL15tb3YgKC4rKXsxLCAyfSQvZ21pcywgSW5zdHJ1Y3Rpb25zW1wiTW92XCJdXSxcclxuXHRcdFsvXm1vYyAoLispezEsIDJ9JC9nbWlzLCBJbnN0cnVjdGlvbnNbXCJNb2NcIl1dLFxyXG5cdFx0Wy9eam1wICguKykkL2dtaXMsIEluc3RydWN0aW9uc1tcIkptcFwiXV0sXHJcblx0XHRbL15pbmMgKC4rKXsxLCAyfSQvZ21pcywgSW5zdHJ1Y3Rpb25zW1wiSW5jXCJdXSxcclxuXHRcdFsvXnNscCggLispPyQvZ21pcywgSW5zdHJ1Y3Rpb25zW1wiU2xwXCJdXSxcclxuXHRcdFsvXmlmKGV8bHxnfGxlfGdlKSggLispezAsIDJ9JC9nbWlzLCBJbnN0cnVjdGlvbnNbXCJJZlwiXV0sXHJcblx0XHRbL14oLispOiQvZ21pcywgSW5zdHJ1Y3Rpb25zW1wiTGFiZWxcIl1dICAvL21ldGhvZCBjYWxsICtbYXddXHJcblx0XSk7XHJcblxyXG5cclxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZChmaWxlOiBzdHJpbmcpOiBQcm9taXNlPFNjb3BlPiB7XHJcblx0XHRpZiAoZXh0bmFtZShmaWxlKSA9PT0gJycpIGZpbGUgKz0gY29uZmlnLmV4dG5hbWU7XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4ge1xyXG5cdFx0XHRmcy5yZWFkRmlsZShmaWxlLCAoZXJyLCBkYXRhKSA9PiB7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHJlcyhTY29wZS5sb2FkKGRhdGEudG9TdHJpbmcoKSkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9IC8vbG9hZFxyXG5cclxufSAvL0pTQVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgSlNBO1xyXG4iXX0=