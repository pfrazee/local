local.onMessage('start', function(message) {
  local.postMessage('my description', {
    hasAjax       : !!XMLHttpRequest,
    hasImporting  : !!importScripts
  });
});

local.onMessage('stream something', function(message) {
  var stream = local.postMessage('streaming something', { a:1 });
  local.postMessage(stream, { b:2 });
  local.postMessage(stream, { c:3 });
  local.endMessage(stream);
});

local.onMessage('ping this back', function(message) {
  local.postMessage('pinging back', message.data);
});

local.onMessage('reply to this message', function(message) {
  local.postReply(message, message.data);
});

local.onMessage('say goodbye', function(message) {
  local.postReply(message, { fairwell:'cruel world' });
});