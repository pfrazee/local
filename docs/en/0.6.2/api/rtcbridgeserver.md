RTCBridgeServer
==================

---

Descends from `local.BridgeServer`. Handles the WebRTC peer connection process and establishes an SCTP DataChannel for exchanging requests with the peer.

Typically created and managed by a `local.Relay` instance.

### local.RTCBridgeServer(config)

 - `config.peer`: required string, who we are connecting to (a valid peer domain)
 - `config.relay`: required local.Relay
 - `config.initiate`: optional bool, if true will initiate the connection processes
 - `config.loopback`: optional bool, is this the local host? If true, will connect to self
 - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
 - `config.retries`: optional number, number of times to retry before giving up (defaults to 3)

## local.RTCBridgeServer

### .getPeerInfo()

 - returns `{ domain:, user:, relay:, app:, sid: }`

```javascript
peerServer.getPeerInfo();
/* => {
	domain: 'bob@grimwire.net!chat.grimwire.com!123',
	user: 'bob',
	relay: 'grimwire.net',
	app: 'chat.grimwire.com',
	sid: '123'
} */
```

---

### .handleRemoteRequest(request, response)

 - `request`: required local.Request
 - `response`: required local.Response

Handles requests from the peer to the page. If not overridden directly or with a server function provided by `config.relay`, will respond 500.

---

### .terminate()

Closes the peer connection.