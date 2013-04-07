localApp.onMessage('start', function(message) {
  localApp.postMessage('my description', {
    hasAjax       : !!XMLHttpRequest,
    hasImporting  : !!importScripts
  });
});

localApp.onMessage('stream something', function(message) {
  var stream = localApp.postMessage('streaming something', { a:1 });
  localApp.postMessage(stream, { b:2 });
  localApp.postMessage(stream, { c:3 });
  localApp.endMessage(stream);
});

localApp.onMessage('ping this back', function(message) {
  localApp.postMessage('pinging back', message.data);
});

localApp.onMessage('reply to this message', function(message) {
  localApp.postReply(message, message.data);
});

localApp.onMessage('say goodbye', function(message) {
  localApp.postReply(message, { fairwell:'cruel world' });
});