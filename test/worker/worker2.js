web.export(main);

var counter = 100;

main.ContentType('text');
main.link(main);
function main() {
	return ''+counter--;
}

main.method(POST);
POST.Accept('text');
POST.ContentType('text');
function POST(req) {
	return req.body.toLowerCase();
}

main.method(BOUNCE);
function BOUNCE() {
	return web.GET('#hello?foo=bob', { bar: 'buzz' });
}