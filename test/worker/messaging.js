// test: basic usage
var done = false;
var startTime = Date.now();

var s1 = new local.env.Worker(function() {
  s1.importScripts('../../test/worker/worker1.js', function(message) {
    print(message);
  });
  s1.nullify('XMLHttpRequest');

  s1.onNamedMessage('started', function(message) {
    print(message);
    s1.postNamedMessage('describe yourself');
  });

  s1.onNamedMessage('my description', function(message) {
    print(message);
    s1.postNamedMessage('stream something');
  });

  s1.onNamedMessage('streaming something', function(message) {
    print(message);
    s1.onNamedMessage(message.id, function(message) {
      print(message);
      if (message.name === 'endMessage') {
        s1.postNamedMessage('ping this back', { foo:'bar' });
      }
    });
  });

  s1.onNamedMessage('reply', function(message) { // uncaught replies
    print(message);
    s1.terminate();
    console.log(Date.now() - startTime, 'ms');
    done = true;
  });

  s1.onNamedMessage('pinging back', function(message) {
    print(message);
    s1.postNamedMessage('reply to this message', null, function(reply) {
      print(reply);

      print('buffering "reply to this message" messages');
      s1.bufferMessages('reply to this message');
      s1.postNamedMessage('reply to this message', 1, print);
      s1.postNamedMessage('reply to this message', 2, print);
      s1.postNamedMessage('reply to this message', 3, endIt);
      print('releasing "reply to this message" messages');
      s1.releaseMessages('reply to this message');
    });
  });

  var endIt = function() {
    s1.postNamedMessage('say goodbye'); // since we don't catch this reply, our uncaught reply handler will be hit
  };

  s1.postNamedMessage('start');
}, { bootstrapUrl:'../lib/worker.js' });

wait(function () { return done; });

/* =>
{data: {error: false}, id: 3, name: "reply", reply_to: 1}
{
  data: {hasAjax: false, hasImporting: true},
  id: 5,
  name: "my description",
  reply_to: undefined
}
{data: {a: 1}, id: 6, name: "streaming something", reply_to: undefined}
{data: {b: 2}, id: 7, name: 6, reply_to: undefined}
{data: {c: 3}, id: 8, name: 6, reply_to: undefined}
{data: 6, id: 9, name: "endMessage", reply_to: undefined}
{data: {foo: "bar"}, id: 10, name: "pinging back", reply_to: undefined}
{data: null, id: 11, name: "reply", reply_to: 6}
buffering "reply to this message" messages
releasing "reply to this message" messages
{data: 1, id: 12, name: "reply", reply_to: 7}
{data: 2, id: 13, name: "reply", reply_to: 8}
{data: {fairwell: "cruel world"}, id: 15, name: "reply", reply_to: 10}
*/