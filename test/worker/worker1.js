var hostConn = local.worker.hostConnection;

hostConn.onExchange('topic1', function(exch1) {
  hostConn.sendMessage(exch1, 'started', 'hello');
  hostConn.onMessage(exch1, 'describe yourself', function() {
    hostConn.sendMessage(exch1, 'my description', {
      hasAjax       : !!XMLHttpRequest,
      hasImporting  : !!importScripts
    });
  });
  hostConn.onMessage(exch1, 'start a topic2 exchange', function() {
    var exch2 = hostConn.startExchange('topic2');
    hostConn.onMessage(exch2, 'ping me', function() {
      hostConn.sendMessage(exch2, 'ping');
    });
    hostConn.onMessage(exch2, 'flood exchange1', function() {
      hostConn.sendMessage(exch1, 'flood', 'foobar');
    });
    hostConn.onMessage(exch2, 'close', function() {
      hostConn.sendMessage(exch1, 'end it');
    });
  });
});