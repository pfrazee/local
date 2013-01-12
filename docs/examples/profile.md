Example: profile.html
=====================

pfraze 2013


```javascript
// Definitions
// ===========

// helpers
function logError(err, request) {
	console.log(err.message, request);
	return err;
}

// request wrapper
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here
	var urld = Link.parse.url(request.url || (request.host + request.path));

	// add the credentials, if targetting our host and currently logged in
	if (Environment.user && /https?/i.test(urld.protocol) && /linkapjs\.com$/i.test(urld.host)) {
		request.headers = Link.headerer(request.headers).setAuth(Environment.user);
	}

	// allow request
	var response = Link.request(request);
	response.except(logError, request);
	return response;
};

// dom update post-processor
Environment.postProcessRegion = function(elem) {
	addPersonaCtrls(elem);
};

// Init
// ====

// instantiate environment servers
var personaServer = new PersonaServer();
Environment.addServer('user.env', personaServer);
var fixtureServer = new StaticServer();
Environment.addServer('fixtures.env', fixtureServer);

// load fixture data into a static service
// :NOTE: an easy alternative to this is a remote php script with JSON and a `header('Content-Type: application/json');`
//        or just a .json file, if your server supplies the content-type correctly
fixtureServer.addCollection('profiles');
fixtureServer.addCollectionItem('profiles', 'lorem.ipsum', {
	fname:'Lorem',
	lname:'Ipsum',
	description:'hacker',
	picture:'/assets/img/hacker.png', // credit to ZARk.be, found at http://www.flickr.com/photos/27515562@N02/3112309337/
	addresses:[
		{ icon:'email', protocol:'mailto', href:'lorem@gmail.com', label:'Personal Email' },
		{ icon:'twitter_1', protocol:'https', href:'//twitter.com/lorem', label:'Personal Twitter' },
		{ icon:'arrow_divide', protocol:'https', href:'//github.com/lorem', label:'Personal Github' }
	],
	info:[
		{
			label:'Projects',
			items:[
				'<a href="#" title="Real Hacker Shit">RHS</a>: LISP interpretter written in Python running on the JVM.',
				'<a href="#" title="Twitbookr">Twitbookr</a>: An open friendship marketplace (bid on your bud!)'
			]
		},
		{
			label:'Friends',
			items:[
				'<a href="https://twitter.com/NeckbeardHacker">Neckbeard Hacker</a>',
				'<a href="https://twitter.com/hipsterhacker">Hipster Hacker</a>',
				'<a href="https://twitter.com/StartupOpsGuy">Startup Ops Guy</a>'
			]
		},
		{
			label:'Hobbies',
			items:[
				'Hacking software',
				'Pwning newbs',
				'Taking down the man',
				'Being the man'
			]
		}
	]
});

// instantiate apps
Environment.addServer('placard.app', new Environment.WorkerServer({ scriptUrl:'/apps/social/placard.js', dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));
Environment.addServer('wall.app', new Environment.WorkerServer({ scriptUrl:'/apps/social/wall.js', dataSource:'http://linkapjs.com:81/wall-posts.php', userSource:'httpl://user.env' }));
Environment.addServer('prof-info.app', new Environment.WorkerServer({ scriptUrl:'/apps/social/prof-info.js', dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));

// load client regions
Environment.addClientRegion('placard').request('httpl://placard.app');
Environment.addClientRegion('wall').request('httpl://wall.app');
Environment.addClientRegion('prof-info').request('httpl://prof-info.app');
```