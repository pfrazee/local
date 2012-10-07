document.addEventListener('DOMContentLoaded', function() {
	Util.logMode('errors', true);
	Util.logMode('traffic', true);
	Util.logMode('sessions', true);
	//Util.logMode('routing', true);
	//Util.logMode('err_types', true);

	Env.init('lshui-env');


	var b = Env.makeAgent('otherguy');
	b.loadProgram('/usr/pfraze/debug.js');

	var a = Env.makeAgent('inbox', { noclose:true });
	a.loadProgram('/usr/pfraze/inbox.js', {
		services:[{ name:'@linkshui', uri:'http://linkshui.com:8600' }]
	});
});
