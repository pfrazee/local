define(['link'], function(Link) {
    var Module = function() {
    };

    Module.prototype.routes = [
        Link.route('intro', { uri:"^/?$", method:'get' }),
        Link.route('tutorial', { uri:"^/tutorial/([0-9]*)/?$", method:'get' })
    ];

    Module.prototype.intro = function(request) {
        var html = [
            '<h2>Welcome to the Link SHell UI</h2>',
            '<p>A command line environment for the web</p>',
            '<p><strong>This project is still in active development.</strong>. ',
            'It may help to <a href="http://www.youtube.com/watch?v=y4Y0XO0BdKM&feature=plcp">watch this screencast</a>.</p>',
            '<p>You can come back to this page at any time by typing `#` into the command line.</p>',
            '<ul>',
            '<li>Try typing `tutorial [] #dm` into the command line at the top.</li>',
            '</ul>'
        ];
        var links = [{ uri:'#tutorial/1', rel:'tutorial' }];
        return Link.response(200, html.join(''), 'text/html', { link:links });
    };

    Module.prototype.tutorial = function(request, match, response) {
        var html = [
            '<ul><li>Good! This buffer will persist while others change.</li></ul>',
            '<ul>',
            '<li>LinkShUI\'s command line is different than most -- it creates HTTP requests.</li>',
            '<li>For instance, try typing `get /env/main.js`. That\'s some source to this program.</li>',
            '<li>To make that prettier, try typing `get /env/main.js [] post prettify`.</li>',
            '</ul>', '<ul>',
            '<li>Another thing that makes LinkShUI different is that its servers can live in the browser.</li>',
            '<li>Type `get /env/modules/google/prettify.js [] post prettify` to see what I mean.</li>',
            '</ul>',
            '<ul><li>These buffers are served from the browser too. Try typing `delete #dm/0`.</li></ul>',
            '<p>Unfortunately, that\'s all I have time for. More to come!</p>'
        ];
        return Link.response(200, html.join(''), 'text/html');
    };


    return Module;
});
