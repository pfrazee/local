Relay
=====

---

Connects to a Grimwire peer relay and manages related `local.RTCBridgeServer` instances. Typically created with `local.joinRelay`:

```javascript
var relay = local.joinRelay('https://myrelay.com');
relay.setServer(function(req, res, peer) {
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
	res.end('Hello, '+peer.getPeerInfo().user);
});
relay.on('accessGranted', function() {
	relay.startListening();
});
relay.requestAccessToken();
```


### local.Relay(config)

 - `config.provider`: optional string, the relay provider
 - `config.serverFn`: optional function, the function for peers' handleRemoteRequest
 - `config.app`: optional string, the app to join as (defaults to window.location.host)
 - `config.sid`: optional number, the stream id (defaults to pseudo-random)
 - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
   - set to false to disable keepalive pings
   - defaults to 45000
 - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
 - `config.retries`: optional number, number of times to retry a peer connection before giving up (defaults to 5)

## local.Relay

### .requestAccessToken(<span class="muted">opts</span>)

 - `opts.guestof`: optional string, the host userid providing the guest account. If specified, attempts to get a guest session.

Creates a popup at the given relay provider asking the user to provide an access token. Note that, because this function spawns a popup, it is best to call it from within a "click" event handler to avoid popup-blockers.

 - If granted, emits the "accessGranted" event.
 - If denied, emits the "accessDenied" event.

---

### .startListening()

Opens a stream to the relay and begins accepting new peer connections and HTTPL traffic.

 - If successful, emits "listening".
 - If unsuccessful due to a conflicting stream id, emits "streamTaken".

---

### .stopListening()

Closes the stream to the relay, but leaves active peer-connections. Emits "notlistening".

---

### .registerLinks(links)

 - `links`: required array

Sends a list of links to the relay to broadcast to other peers. If relative URLs are given, the relay will automatically prepend the application's assigned hostname.

---

### .agent()

 - returns local.Agent

Provides an agent which points at the relay's peer index. Can be used to navigate the links registered by peers.

---

### .getUsers()

 - returns promise(response)

Fetches the user list from the relay.

```javascript
relay.getUsers().then(function(res) {
	console.log(res.body.rows.bob); // => { id: "bob", avatar: "user.png", created_at: "2013-09-23T23:08:44.615Z", online: true }
});
```

---

### .getUser(userId)

 - `userId`: required string
 - returns promise(response)

Fetches the given user info from the relay.

```javascript
relay.getUser('bob').then(function(res) {
	console.log(res.body.item); // => { id: "bob", avatar: "user.png", created_at: "2013-09-23T23:08:44.615Z", online: true }
});
```

---

### .connect(peerUrl, <span class="muted">config</span>)

 - `peerUrl`: required String, the domain/url of the target peer
 - `config.initiate`: optional Boolean, should the server initiate the connection?
   - defaults to true
   - should only be false if the connection was already initiated by the opposite end
 - `config.retryTimeout`: optional number, time (in ms) before a connection is aborted and retried (defaults to 15000)
 - `config.retries`: optional number, number of times to retry before giving up (defaults to 5)
 - returns local.RTCBridgeServer

Manually initiates a connection to the given peer. Called by `dispatch()` when a request targets a peer that is not yet connected.

---

### .makeDomain(userId, app, sid)

 - `userId`: required string
 - `app`: required string
 - `sid`: required number
 - returns string

Creates a peer domain for the relay with the given information.

---

## local.Relay Accessors

<table class="table">
	<tr><td>**.getAssignedDomain()**</td><td>Returns string. Gets the domain assigned to the page by the relay.</td></tr>
	<tr><td>**.getAssignedUrl()**</td><td>Returns string. Gets the full peer URI assigned to the page by the relay.</td></tr>
	<tr><td>**.getAccessToken()**</td><td>Returns string.</td></tr>
	<tr><td>**.setAccessToken(token)**</td><td>`token`: required string. The relay instance will immediately send a HEAD request to verify the token's authenticity.<br>
		If valid, emits the "accessGranted" event.<br>
		If invalid, emits the "accessInvalid" event.<br>
		If `token` is falsey and the relay previously had a token, "accessRemoved" is emitted.</td></tr>
	<tr><td>**.getServer()**</td><td>Returns function|object.</td></tr>
	<tr><td>**.setServer(v)**</td><td>`v`: required function|object, the function for peers' handleRemoteRequest.</td></tr>
	<tr><td>**.getUserId()**</td><td>Returns string.</td></tr>
	<tr><td>**.getApp()**</td><td>Returns string.</td></tr>
	<tr><td>**.setApp(v)**</td><td>`v`: required string, the domain of the application (defaults to window.location.host).</td></tr>
	<tr><td>**.getSid()**</td><td>Returns number.</td></tr>
	<tr><td>**.setSid(v)**</td><td>`v`: required number.</td></tr>
	<tr><td>**.getProvider()**</td><td>Returns string.</td></tr>
	<tr><td>**.setProvider(v)**</td><td>`v`: required string, the relay provider URL.</td></tr>
	<tr><td>**.getRetryTimeout()**</td><td>Returns number.</td></tr>
	<tr><td>**.setRetryTimeout(v)**</td><td>`v`: required number, time (in ms) before a peer connection is aborted and retried (defaults to 15000).</td></tr>
</table>

---

## local.Relay Events

<table class="table">
	<tr><td>"listening"</td><td>`function() { }`</td><td>A stream has been opened to the relay and new connections/traffic will now be accepted.</td></tr>
	<tr><td>"notlistening"</td><td>`function() { }`</td><td>The stream to the relay has been closed.</td></tr>
	<tr><td>"error"</td><td>`function(errorEvent, peer) { }`</td><td>`errorEvent.error` provides a description of the error. If a general relay error, `peer` will be undefined.</td></tr>
	<tr><td>"accessGranted"</td><td>`function() { }`</td><td>The access token has been validated.</td></tr>
	<tr><td>"accessRemoved"</td><td>`function() { }`</td><td>A previously-set access token has been removed.</td></tr>
	<tr><td>"accessDenied"</td><td>`function() { }`</td><td>The user denied access to the relay when prompted.</td></tr>
	<tr><td>"accessInvalid"</td><td>`function() { }`</td><td>The access token was reported invalid by the relay, typically due to expiration.</td></tr>
	<tr><td>"streamTaken"</td><td>`function() { }`</td><td>The requested stream id is in use, try to connect again with a different ID.</td></tr>
	<tr><td>"outOfStreams"</td><td>`function() { }`</td><td>The relay account has used all of its allocated streams and can not allocate any more.</td></tr>
	<tr><td>"connecting"</td><td>`function(peerInfo, peer) { }`</td><td>Signals that a WebRTC connection process has been initiated.</td></tr>
	<tr><td>"connected"</td><td>`function(peerInfo, peer) { }`</td><td>Signals that a WebRTC connection has been established.</td></tr>
	<tr><td>"disconnected"</td><td>`function(peerInfo, peer) { }`</td><td>Signals that a WebRTC connection has been closed.</td></tr>
</table>