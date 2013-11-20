// == SECTION xhr local requests

// local request 1

done = false;
startTime = Date.now();
var xhr = new XMLHttpRequest();
xhr.open('GET', 'httpl://localserver');
xhr.onreadystatechange = function() {
	print(xhr.readyState);
	print(xhr.responseText);
	if (xhr.readyState == 4) {
		print('done');
		print(xhr.getResponseHeader('content-type'));
		print(xhr.getAllResponseHeaders());
		print(typeof xhr.response);
		print(xhr.response);
		done = true;
	}
};
xhr.send();
wait(function () { return done; });

/* =>
2
null
3
service resource
4
service resource
done
text/plain
{
  "content-type": "text/plain",
  link: "</>; rel=\"self current http://grimwire.com/rel/test grimwire.com/rel/test grimwire.com\", </events>; rel=\"collection\"; id=\"events\", </foo>; rel=\"collection\"; id=\"foo\", </{id}>; rel=\"collection\""
}
string
service resource
*/

// local request 2

done = false;
startTime = Date.now();
var xhr = new XMLHttpRequest();
xhr.open('GET', 'httpl://localserver/foo');
xhr.onreadystatechange = function() {
	print(xhr.readyState);
	print(xhr.responseText);
	if (xhr.readyState == 4) {
		print('done');
		print(xhr.getResponseHeader('content-type'));
		print(xhr.getAllResponseHeaders());
		print(typeof xhr.response);
		print(xhr.response);
		done = true;
	}
};
xhr.send();
wait(function () { return done; });

/* =>
2
null
3
[
3
["bar"
3
["bar","baz"
3
["bar","baz","blah"
3
["bar","baz","blah"]
4
["bar","baz","blah"]
done
application/json
{
  "content-type": "application/json",
  link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
}
string
["bar","baz","blah"]
*/

// local request 3

done = false;
startTime = Date.now();
var xhr = new XMLHttpRequest();
xhr.open('GET', 'httpl://localserver/foo');
xhr.onreadystatechange = function() {
	print(xhr.readyState);
	print(xhr.responseText);
	if (xhr.readyState == 4) {
		print('done');
		print(xhr.getResponseHeader('content-type'));
		print(xhr.getAllResponseHeaders());
		print(typeof xhr.response);
		print(xhr.response);
		done = true;
	}
};
xhr.responseType = 'json';
xhr.send();
wait(function () { return done; });

/* =>
2
null
3
[
3
["bar"
3
["bar","baz"
3
["bar","baz","blah"
3
["bar","baz","blah"]
4
["bar","baz","blah"]
done
application/json
{
  "content-type": "application/json",
  link: "</>; rel=\"up via service\", </foo>; rel=\"self current\", </foo/{id}>; rel=\"item\""
}
object
["bar", "baz", "blah"]
*/

// local request 4

done = false;
startTime = Date.now();
var xhr = new XMLHttpRequest();
xhr.open('POST', 'httpl://localserver/foo');
xhr.onreadystatechange = function() {
	print(xhr.readyState);
	print(xhr.responseText);
	if (xhr.readyState == 4) {
		print('done');
		print(xhr.getResponseHeader('content-type'));
		print(xhr.getAllResponseHeaders());
		print(typeof xhr.response);
		print(xhr.response);
		done = true;
	}
};
xhr.setRequestHeader('content-type', 'text/plain');
xhr.send('hello, world');
wait(function () { return done; });

/* =>
2
null
3
hello, world
4
hello, world
done
text/plain
{"content-type": "text/plain"}
string
hello, world
*/