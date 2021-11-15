import * as util from "./util";

test("truthy strings", () => {
	util.testFunction`
		const foo = "";
		if (foo) {
			return true;
		}
		else return false;
	`.expectToMatchJsResult();
});

test("falsy string logical and", () => {
	util.testFunction`
		return "" || "dog";
	`.expectToMatchJsResult();
});

test("truthy numbers", () => {
	util.testFunction`
		const foo = 0;
		const bar = NaN;
		const results = [];

		if (foo) { results.push(true); } else { results.push(false); }
		if (bar) { results.push(true); } else { results.push(false); }

		return results;
	`.expectToMatchJsResult();
});

test("falsy number logical and", () => {
	util.testFunction`
		return 0 || 100;
	`.expectToMatchJsResult();
});

test("falsy", () => {
	util.testFunction`
		const results = [];

		if (false) results.push(1);
		if (null) results.push(2);
		if (undefined) results.push(3);
		if (0) results.push(4);
		if (-0) results.push(5);
		if (NaN) results.push(6);
		if ("") results.push(7);

		return results;
	`.expectToMatchJsResult();
});

test("truthy", () => {
	util.testFunction`
		const results = [];

		if (true) results.push(1);
		if ({}) results.push(2);
		if ([]) results.push(3);
		if (42) results.push(4);
		if ("0") results.push(5);
		if ("false") results.push(6);
		if (-42) results.push(7);
		if (3.14) results.push(8);
		if (-3.14) results.push(9);
		if (Infinity) results.push(10);
		if (-Infinity) results.push(11);

		return results;
	`.expectToMatchJsResult();
});
