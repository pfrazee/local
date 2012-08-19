
// config
$prof.programs = {};
$prof.programs.mail = 'app/inbox';
$prof.programs.feed = 'app/statfeed';

// includes
require(['modules/pfraze/doclev/agent_ext', 'modules/pfraze/doclev/commands'], function() {
    // inital programs
    load('mail');
});

console.log('Welcome, user.');
