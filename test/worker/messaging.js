// test: basic usage
var done = false;
var startTime = Date.now();

function printLog() {
  var args = Array.prototype.slice.call(arguments);
  print.apply(null, args);
  // console.log.apply(console, args);
}

var s1 = new local.env.Worker({ bootstrapUrl:'../worker.js' });
s1.onMessage(0, 'ready', function() {
  printLog('got ready');

  s1.importScripts('test/worker/worker1.js', function(message) {
    printLog(message);
  });
  s1.nullify('XMLHttpRequest');

  var exch1 = s1.startExchange('topic1');
  s1.onMessage(exch1, 'started', function(message) {
    printLog(message);
    s1.sendMessage(exch1, 'describe yourself');
  });
  s1.onMessage(exch1, 'my description', function(message) {
    printLog(message);
    s1.sendMessage(exch1, 'start a topic2 exchange');
  });

  s1.onExchange('topic2', function(exch2) {
    printLog('topic2 exchange started');
    s1.sendMessage(exch2, 'ping me');
    s1.onMessage(exch2, 'ping', function(message) {
      printLog(message);
      printLog('suspending exchange1');
      s1.suspendExchange(exch1);
      printLog('flooding exchange1');
      s1.sendMessage(exch2, 'flood exchange1');
      s1.sendMessage(exch2, 'flood exchange1');
      s1.sendMessage(exch2, 'flood exchange1');
      printLog('resuming exchange1');
      s1.resumeExchange(exch1);
      printLog('closing exchange2');
      s1.endExchange(exch2);
    });
    s1.onMessage(exch2, 'close', function(message) {
      printLog('exchange2 closed');
    });
  });

  s1.onMessage(exch1, 'flood', function(message) {
    printLog(message);
  });

  s1.onMessage(exch1, 'end it', function(message) {
    print(message);
    s1.terminate();
    console.log(Date.now() - startTime, 'ms');
    done = true;
  });
});

wait(function () { return done; });

/* =>
got ready
{data: {error: false}, exchange: 1, id: 3, label: "done"}
{data: "hello", exchange: 2, id: 8, label: "started"}
{
  data: {hasAjax: false, hasImporting: true},
  exchange: 2,
  id: 9,
  label: "my description"
}
topic2 exchange started
{data: undefined, exchange: -1, id: 11, label: "ping"}
suspending exchange1
flooding exchange1
resuming exchange1
closing exchange2
exchange2 closed
{data: "foobar", exchange: 2, id: 12, label: "flood"}
{data: "foobar", exchange: 2, id: 13, label: "flood"}
{data: "foobar", exchange: 2, id: 14, label: "flood"}
{data: undefined, exchange: 2, id: 15, label: "end it"}
*/