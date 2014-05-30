// setup
var mainDiv = document.getElementById('testarea');
web.bindRequestEvents(mainDiv);

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
{Accept: null, method: null, target: null, url: "http://www.atag1.com"}
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
  Accept: "text/plain",
  method: "POST",
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
  ContentType: "application/x-www-form-urlencoded",
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
  ContentType: "application/json",
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
  method: "patch",
  target: "target1",
  url: "http://www.form1.com/foobar"
}
*/

// test: basic form, button in a fieldset
done = false;
startTime = Date.now();

var clickEvent = document.createEvent('MouseEvents');
clickEvent.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
document.getElementById('form1submit3').dispatchEvent(clickEvent);

wait(function () { return done; });

/* =>
{
  ContentType: "application/json",
  body: {
    check1: ["b"],
    form1submit3: "form1submit3 value",
    radio1: "radio1 value1",
    radio2: "radio2 value2",
    select1: "select1 value1",
    select2: "select2 value2",
    select3: "select3 value3",
    text1: "text1 value",
    text2: "text2 value",
    textarea1: "textarea 1 value"
  },
  method: "patch",
  target: "target1",
  url: "http://www.form1.com/foobaz"
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
  ContentType: "application/json",
  body: {},
  method: "post",
  target: "target1",
  url: "http://www.form2.com"
}
*/


web.unbindRequestEvents(mainDiv);