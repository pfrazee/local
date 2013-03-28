// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = Link;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return Link;
	});
}