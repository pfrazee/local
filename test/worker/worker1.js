local.worker.onNamedMessage('start', function(message) {
  local.worker.postNamedMessage('my description', {
    hasAjax       : !!XMLHttpRequest,
    hasImporting  : !!importScripts
  });
});

local.worker.onNamedMessage('stream something', function(message) {
  var stream = local.worker.postNamedMessage('streaming something', { a:1 });
  local.worker.postNamedMessage(stream, { b:2 });
  local.worker.postNamedMessage(stream, { c:3 });
  local.worker.endMessage(stream);
});

local.worker.onNamedMessage('ping this back', function(message) {
  local.worker.postNamedMessage('pinging back', message.data);
});

local.worker.onNamedMessage('reply to this message', function(message) {
  local.worker.postReply(message, message.data);
});

local.worker.onNamedMessage('say goodbye', function(message) {
  local.worker.postReply(message, { fairwell:'cruel world' });
});