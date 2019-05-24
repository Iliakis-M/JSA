"use strict";

const mod = require("../");

mod.JSA.load("test/langtest1").then(scope => {
	console.log(scope);
});
