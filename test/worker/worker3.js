myvar1 = 'overwritten-as-expected';
var myvar2 = 'shouldnt-be-overwritten';
vars = null;
module.exports.myvar = 'worker3var';
function main(request, response) {
	response.writeHead(200, 'ok', {'content-type':'application/json'});
	response.end({yougot:'hijacked!'});
}