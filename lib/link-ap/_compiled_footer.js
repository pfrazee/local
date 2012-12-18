// set up for node or AMD
if (typeof module !== "undefined") {
	module.exports = LinkAP;
}
else if (typeof define !== "undefined") {
	define([], function() {
		return LinkAP;
	});
}