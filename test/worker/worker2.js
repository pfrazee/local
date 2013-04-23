var myvar1 = 'worker2var';
var myvar2 = 'worker2var';
var worker3 = require('worker3.js');
var vars = {
	mine1: myvar1,
	mine2: myvar2,
	theirs: worker3.myvar
};
function main(request, response) {
	response.writeHead(200, 'ok', {'content-type':'application/json'});
	response.end(vars);
}