// Helper for determining the globals object in the given context
if (typeof globals == 'undefined') {
	if (typeof window != 'undefined') {
		globals = window;
	}
	if (typeof self != 'undefined') {
		globals = self;
	}
}