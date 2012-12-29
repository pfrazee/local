// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = App;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return App;
	});
}