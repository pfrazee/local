web.export(main);

var counter = 0;

main.ContentType('text');
main.link(main);
function main() {
	return ''+counter++;
}

main.method(POST);
POST.Accept('text');
POST.ContentType('text');
function POST(req) {
	return req.body.toUpperCase();
}

main.method(BOUNCE);
function BOUNCE() {
	return web.GET('#hello?foo=alice', { bar: 'bazz' });
}

main.method(IMPORT);
IMPORT.ContentType('text');
function IMPORT() {
	try {
		importScripts('../../local.js');
		throw 'Error: import was allowed';
	} catch (e) {
		return e.toString();
	}
}

main.method(USEWEB);
function USEWEB() {
    return web.GET('https://layer1.io');
}