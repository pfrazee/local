// setup
var mainDiv = document.getElementById('testarea');
CommonClient.listen(mainDiv);

// test: basic anchor tag
var done = false;
var startTime = Date.now();

function printHandler(e) {
	print(e.detail);
	console.log(Date.now() - startTime, 'ms');
	done = true;
}

mainDiv.addEventListener('request', printHandler);

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('atag1').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
	headers: {accept: null},
	method: "get",
	target: null,
	url: "http://www.atag1.com"
}
*/

// test: completely-filled anchor tag
done = false;
startTime = Date.now();

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('atag2').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
	headers: {accept: "text/plain"},
	method: "get",
	target: "target1",
	url: "http://www.atag2.com"
}
*/

// test: target=_top
done = false;
startTime = Date.now();

window.location.hash = '';

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
window.onhashchange =  function(e) {
  if (!done) {
    print('hash changed');
    console.log(Date.now() - startTime, 'ms');
    done = true;
  }
};
document.getElementById('atag3').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
hash changed
*/

// test: basic form
done = false;
startTime = Date.now();

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form1submit1').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
	body: {
		check1: ["b"],
		radio1: "radio1 value1",
		radio2: "radio2 value2",
		select1: "select1 value1",
		select2: "select2 value2",
		select3: "select3 value3",
		text1: "text1 value",
		text2: "text2 value",
		textarea1: "textarea 1 value"
	},
	headers: {"content-type": "application/x-www-form-urlencoded"},
	url: "http://www.form1.com"
}
*/

// test: basic form, detailed button
done = false;
startTime = Date.now();

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form1submit2').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
	body: {
		check1: ["b"],
		form1submit2: "form1submit2 value",
		radio1: "radio1 value1",
		radio2: "radio2 value2",
		select1: "select1 value1",
		select2: "select2 value2",
		select3: "select3 value3",
		text1: "text1 value",
		text2: "text2 value",
		textarea1: "textarea 1 value"
	},
	headers: {"content-type": "application/json"},
	method: "patch",
	target: "target1",
	url: "http://www.form1.com/foobar"
}
*/

// test: detailed form
done = false;
startTime = Date.now();

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form2submit1').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
	body: {},
	headers: {"content-type": "application/json"},
	method: "post",
	target: "target1",
	url: "http://www.form2.com"
}
*/

// test: response interpretation
done = false;
startTime = Date.now();

function request1Handler(e) {
	// fixture response
	var response = { status:200, reason:'Ok', headers:{ 'content-type':'text/html' }, body:'<h1>Response 1</h1>' };

	// pass on to common client
	CommonClient.handleResponse(
		document.getElementById(e.detail.target),
		document.getElementById('testarea'),
		response
	);
}

mainDiv.addEventListener('request', request1Handler);

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form1submit2').dispatchEvent(clickEvent);
print(document.getElementById('target1').innerHTML);

mainDiv.removeEventListener('request', request1Handler);

wait(function () { return done; });

/* =>
{
	body: {
		check1: ["b"],
		form1submit2: "form1submit2 value",
		radio1: "radio1 value1",
		radio2: "radio2 value2",
		select1: "select1 value1",
		select2: "select2 value2",
		select3: "select3 value3",
		text1: "text1 value",
		text2: "text2 value",
		textarea1: "textarea 1 value"
	},
	headers: {"content-type": "application/json"},
	method: "patch",
	target: "target1",
	url: "http://www.form1.com/foobar"
}
<h1>Response 1</h1>
*/

// test: attr event binding
done = false;
startTime = Date.now();

function request2Handler(e) {
	// fixture response
	var response = {
		status:200, reason:'Ok', headers:{ 'content-type':'text/html' },
		body:[
			'<form method="get" action="http://www.form3.com" target="target2" onchange="delete">',
			'<input type="text" name="text1" onchange="patch" />',
			'<input type="text" name="text2" onkeyup="put" formaction="http://www.form3.com/foobar" />',
			'<fieldset formaction="http://www.form3.com/foobaz" onchange="patch">',
			'<input type="text" name="text3" />',
			'<input type="text" name="text4" onkeydown="patch" formenctype="application/json" />',
			'</fieldset>',
			'<input type="text" name="text5" />',
			'</form>'
		].join('')
	};

	// pass on to common client
	CommonClient.handleResponse(
		document.getElementById('target2'),
		document.getElementById('testarea'),
		response
	);
}

mainDiv.addEventListener('request', request2Handler);

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form1submit2').dispatchEvent(clickEvent);
print(document.getElementById('target2').innerHTML);

mainDiv.removeEventListener('request', request2Handler);

wait(function () { return done; });
done = false;

var region = document.getElementById('target2');

var changeEvent = document.createEvent('UIEvents');
changeEvent.initUIEvent('change', true, true, window, {});
region.querySelector('[name=text1]').value = 'foobar';
region.querySelector('[name=text1]').dispatchEvent(changeEvent);

wait(function () { return done; });
done = false;

var keyupEvent = document.createEvent('UIEvents');
keyupEvent.initUIEvent('keyup', true, true, window, {});
region.querySelector('[name=text2]').value = 'foobaz';
region.querySelector('[name=text2]').dispatchEvent(keyupEvent);

wait(function () { return done; });
done = false;

var changeEvent = document.createEvent('UIEvents');
changeEvent.initUIEvent('change', true, true, window, {});
region.querySelector('[name=text3]').value = 'foobleh';
region.querySelector('[name=text4]').value = 'foobot';
region.querySelector('[name=text3]').dispatchEvent(changeEvent);

wait(function () { return done; });
done = false;

var keydownEvent = document.createEvent('UIEvents');
keydownEvent.initUIEvent('keydown', true, true, window, {});
region.querySelector('[name=text4]').dispatchEvent(keydownEvent);

wait(function () { return done; });
done = false;

var changeEvent = document.createEvent('UIEvents');
changeEvent.initUIEvent('change', true, true, window, {});
region.querySelector('[name=text5]').value = 'foobloat';
region.querySelector('[name=text5]').dispatchEvent(changeEvent);

wait(function () { return done; });

/* =>
{
  body: {
    check1: ["b"],
    form1submit2: "form1submit2 value",
    radio1: "radio1 value1",
    radio2: "radio2 value2",
    select1: "select1 value1",
    select2: "select2 value2",
    select3: "select3 value3",
    text1: "text1 value",
    text2: "text2 value",
    textarea1: "textarea 1 value"
  },
  headers: {"content-type": "application/json"},
  method: "patch",
  target: "target1",
  url: "http://www.form1.com/foobar"
}
<form method="get" action="http://www.form3.com" target="target2"><input type="text" name="text1"><input type="text" name="text2" formaction="http://www.form3.com/foobar"><fieldset formaction="http://www.form3.com/foobaz"><input type="text" name="text3"><input type="text" name="text4" formenctype="application/json"></fieldset><input type="text" name="text5"></form>
{
  body: {text1: "foobar"},
  headers: {"content-type": "application/x-www-form-urlencoded"},
  method: "patch",
  target: "target2",
  url: "http://www.form3.com"
}
{
  body: {text2: "foobaz"},
  headers: {"content-type": "application/x-www-form-urlencoded"},
  method: "put",
  target: "target2",
  url: "http://www.form3.com/foobar"
}
{
  body: {text3: "foobleh", text4: "foobot"},
  headers: {"content-type": "application/x-www-form-urlencoded"},
  method: "patch",
  target: "target2",
  url: "http://www.form3.com/foobaz"
}
{
  body: {text4: "foobot"},
  headers: {"content-type": "application/json"},
  method: "patch",
  target: "target2",
  url: "http://www.form3.com/foobaz"
}
{
  body: {
    text1: "foobar",
    text2: "foobaz",
    text3: "foobleh",
    text4: "foobot",
    text5: "foobloat"
  },
  headers: {"content-type": "application/x-www-form-urlencoded"},
  method: "delete",
  target: "target2",
  url: "http://www.form3.com"
}
*/

// test: output subscription
done = false;
startTime = Date.now();

var streams = [];
var ready = false;

Link.registerLocal('event-emitter.com', function(request, response) {
	response.writeHead(200, 'ok', { 'content-type':'text/event-stream' });
	streams.push(response);
	if (streams.length === 2) {
		print("2 streams loaded");
		ready = true;
	}
});

CommonClient.handleResponse(
	document.getElementById('target3'),
	document.getElementById('testarea'),
	{ status:200, reason:'Ok', headers: { 'content-type':'text/html' },
		body:[
			'<div data-subscribe="httpl://event-emitter.com" id="form1output1"></div>',
			'<span data-subscribe="httpl://event-emitter.com" id="form1output2"></span>',
			'</form>'
		].join('')
	}
);

wait(function () { return ready; });

// => 2 streams loaded

streams[0].write({ event:'update' });
streams[0].write({ event:'other' });
streams[1].write({ event:'other' });
streams[1].write({ event:'update', data:['irrelevant']});

/* =>
{
  headers: {accept: "text/html"},
  method: "get",
  url: "httpl://event-emitter.com"
}
{
  headers: {accept: "text/html"},
  method: "get",
  url: "httpl://event-emitter.com"
}
*/

CommonClient.unlisten(mainDiv);