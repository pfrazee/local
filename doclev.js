//
// document level initialization
//
// - the document level is separated from program components loaded with RequireJS
// - it is wide open for user symbols
// - this file defines connector APIs to the env in the program-level

var $a = null; // agents manager
var $a_cons = null; // agent constructor function
var $io = null; // linkjs structure
var $prof = { // profile config vars
    def_request_method:'get',
    def_request_accept:'application/html+json'
};
var Promise = null; // promise constructor

// make connections to program level
require(['env/env', 'assets/js/link'], function(Env, Link) {
    Env.is_loaded.then(function() {
        $a = Env.agents;
        $a_cons = Env.AgentConstructor;
        $io = Env.structure;
        Promise = Link.Promise;
        Promise.when = Link.when; // :TODO: this smells
        Promise.whenAll = Link.whenAll; // :TODO: also smells
        require_doclev(env_config.doclev);
    });
});

// `uri` may be a string or an array of strings
function require_doclev(uri) {
    if (Array.isArray(uri)) {
        uri.forEach(require_doclev);
        return;
    }
    if (/\/\//.test(uri) == false) { // no protocol?
        uri = '/doclev/' + uri + '.js'; // mimics requirejs path style
    }
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = uri;
    var promise = new Promise();
    script.onload = function() {
        promise.fulfill(true);
    };
    document.head.insertBefore(script, document.head.firstChild);

    return promise;
}
