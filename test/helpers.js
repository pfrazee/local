
// test runner helpers

var done;
var startTime;
function printSuccess(res) {
	print('success');
	print(res);
	return res;
}
function printError(res) {
	print('error');
	print(res);
	throw res;
}
function finishTest(res) {
	console.log('Test Duration:', Date.now() - startTime, 'ms');
    if (res && res.latency) console.log('Request latency:',res.latency,'ms');
	done = true;
}
function printSuccessAndFinish(res) { printSuccess(res); finishTest(); }
function printErrorAndFinish(err) { print('error'); print(err); finishTest(); }