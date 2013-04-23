// test: require() calls
var done = false;
var startTime = Date.now();

local.env.config.workerBootstrapUrl = '../lib/worker.js';
local.env.addServer('requirer.usr', new local.env.WorkerServer({scriptUrl:'../../test/worker/worker2.js'}));
local.http.dispatch({ method:'get', url:'httpl://requirer.usr' })
	.then(function(res) {
		print(res.body);
		return true;
	}, function(res) {
		print('Error');
		print(res);
		return true;
	})
	.then(function() {
		console.log(Date.now() - startTime, 'ms');
		done = true;
	});
	
wait(function () { return done; });

/* =>
{mine1: "overwritten-as-expected", mine2: "worker2var", theirs: "worker3var"}
*/