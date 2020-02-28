#!/usr/bin/env node

"use strict";

import JSA from "../lib/jsa";

process.title = "JSA";

if (process.argv[2]) {
	JSA.load(process.argv[2]).then((scope: JSA.Scope) => scope.call(), (msg: Error) => console.error(msg.message));
} else {
	console.log("jsa filename<String>");
}
