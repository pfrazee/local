
// config
$prof.programs = {};

// includes
require([
    'modules/mousetrap/mousetrap',
    'modules/pfraze/doclev/agent_ext',
    'modules/pfraze/doclev/commands'
], function(Mousetrap) {

    // keybindings
    Mousetrap.bind('alt+enter', function() {
        load('app/commander');
    });

    // initial programs
    load('app/statfeed','feed');
    load('app/inbox','mail');

});

console.log('Welcome, user.');
