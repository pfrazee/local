BridgeServer
============

---

Descends from `local.Server`.

Base type for all servers which pipe requests between separated environments (eg WorkerBridgeServer, RTCBridgeServer). Requires the channel between the environments to be reliable and capable of transporting arbitrarily-sized messages.

## local.BridgeServer

### .isChannelActive()

 - returns boolean

Indicates whether the channel is ready. If false, new outgoing messages will be buffered. Should be overridden.

---

### .channelSendMsg(msg)

 - `msg`: required string

Sends the given message to the remote environment. Should be overridden.

```javascript
WorkerServer.prototype.channelSendMsg = function(msg) {
	this.worker.postMessage(msg);
};
```

---

### .onChannelMessage(msg)

 - `msg`: required string

Handles messages from the remote environment. Should be called by the descendent type on new messages.

---

### .handleRemoteRequest(req, res)

 - `req`: required local.Request
 - `res`: required local.Response

Called to handle requests by the remote environment. Should be overridden.

---

### .flushBufferedMessages()

Flushes any messages which were buffered before the channel was active. Should be called by the descendent type on channel open.

---

### .useMessageReordering(v)

 - `v`: required boolean

Enables/disables head-of-line blocking in streams through message-numbering. Useful for channels which do not guarantee order.