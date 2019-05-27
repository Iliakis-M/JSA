"use strict";

const mod = require("../");

process.title = "JSA-test";
process.debugPort = 9229;

mod.JSA.load("test/langtest1").then(scope => {
	scope.call()//.then(() => console.log(scope));
});
