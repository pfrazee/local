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
        require(env_config.loadscripts);
    });
});