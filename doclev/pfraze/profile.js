
// config
$prof.programs = {};
$prof.programs.mail = 'app/inbox';
$prof.programs.feed = 'app/statfeed';

// includes
Promise.whenAll([
    require_doclev('pfraze/agent_ext'),
    require_doclev('pfraze/commands')
], function() {

    // inital programs
    load('mail');

});

console.log('Welcome, user.');
