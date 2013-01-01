// Definitions
// ===========

// helpers
function logError(err) {
	if (err.request) { console.log(err.message, err.request); }
	else { console.log(err.message);}
	return err;
}

// request wrapper
Environment.request = function(origin, request) {
	// make any connectivity / permissions decisions here

	// allow request
	var response = Link.request(request);
	response.except(logError);
	return response;
};

// response html processor
Environment.postProcessRegion = function(elem) {
	addPersonaCtrls(elem);
};

// Init
// ====

// instantiate environment servers
var fixtureServer = new StaticServer();
Environment.addServer('fixtures.env', fixtureServer);

// load fixture data into a static service
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
fixtureServer.addCollection('posts', Array);
fixtureServer.addCollectionItem('posts', { author:'someguy@aol.com', content:'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' });
fixtureServer.addCollectionItem('posts', { author:'lorem@gmail.com', content:'<a href="http://flickr.com/myphotos">http://flickr.com/myphotos</a> trip photos' });
fixtureServer.addCollectionItem('posts', { author:'another.guy@somewhere.com', content:'This is a wall post.' });

// instantiate apps
Environment.addServer('placard.app', new Environment.WorkerServer('/apps/social/placard.js', { dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));
Environment.addServer('wall.app', new Environment.WorkerServer('/apps/social/wall.js', { dataSource:'httpl://fixtures.env/posts' }));
Environment.addServer('prof-info.app', new Environment.WorkerServer('/apps/social/prof-info.js', { dataSource:'httpl://fixtures.env/profiles/lorem.ipsum' }));

// load client regions
Environment.addClient('#placard').request('httpl://placard.app');
Environment.addClient('#wall').request('httpl://wall.app');
Environment.addClient('#prof-info').request('httpl://prof-info.app');