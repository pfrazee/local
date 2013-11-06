Relay
=====

---

Connects to a Grimwire peer relay and manages related `local.RTCBridgeServer` instances.


### local.Relay(config)

 - `config.provider`: optional string, the relay provider
 - `config.serverFn`: optional function, the function for peers' handleRemoteRequest
 - `config.app`: optional string, the app to join as (defaults to window.location.host)
 - `config.stream`: optional number, the stream id (defaults to pseudo-random)
 - `config.ping`: optional number, sends a ping to self via the relay at the given interval (in ms) to keep the stream alive
   - set to false to disable keepalive pings
   - defaults to 45000
 - `config.retryTimeout`: optional number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)
 - `config.retries`: optional number, number of times to retry a peer connection before giving up (defaults to 5)

## local.Relay

### .getAccessToken()

 - returns string

---

### .setAccessToken(token)

 - `token`: required string

The relay instance will immediately send a HEAD request to verify the token's authenticity.

 - If valid, emits the "accessGranted" event.
 - If invalid, emits the "accessInvalid" event.

If `token` is falsey and the relay previously had a token, "accessRemoved" is emitted.

---

### .requestAccessToken()

Creates a popup at the given relay provider asking the user to provide an access token.

 - If granted, emits the "accessGranted" event.
 - If denied, emits the "accessDenied" event.

---

### .getServer()

 - returns function|object

---

### .setServer(v)

 - `v`: required function|object, the function for peers' handleRemoteRequest

```javascript
relay.setServer(function(req, res, peer) {
	res.writeHead(200, 'ok', { 'content-type': 'text/plain' });
	res.end('Hello, '+peer.getPeerInfo().user);
});
```

---

### .startListening()

Opens a stream to the relay and begins accepting new peer connections and HTTPL traffic.

 - If successful, emits "listening".
 - If unsuccessful due to a conflicting stream id, emits "streamTaken".

---

### .stopListening()

Closes the stream to the relay, but leaves active peer-connections. Emits "notlistening".

---

### .getDomain()

 - returns string

Gets the domain assigned to the page by the relay.

---

### .getUsers()

 - returns promise(response)

Fetches the user list from the relay.

---

### .getUser(userId)

 - returns promise(response)

Fetches the given user info from the relay.

---

### .registerLinks(links)

 - `v`: required array

Sends a list of links to the relay to broadcast to other peers. If relative URLs are given, the relay will automatically prepend the application's assigned hostname.

---

### .agent()

 - returns local.Agent

Provides an agent which points at the relay's peer index. Can be used to navigate the links registered by peers.

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

### .makeDomain(userId, app, streamId)

 - `userId`: required string
 - `app`: required string
 - `streamId: required number
 - returns string

Creates a peer domain for the relay with the given information.

---

### .getUserId()

 - returns string

---

### .getApp()

 - returns string

---

### .setApp(v)

 - `v`: required string, the domain of the application (defaults to window.location.host)

---

### .getStreamId()

 - returns number

---

### .setStreamId(v)

 - `v`: required number

---

### .getProvider()

 - returns string

---

### .setProvider(v)

 - `v`: required string, the relay provider URL

```javascript
relay.setProvider('https://my-relay.net');
```

---

### .getRetryTimeout()

 - returns number

---

### .setRetryTimeout(v)

 - `v`: required number, time (in ms) before a peer connection is aborted and retried (defaults to 15000)

## local.Relay Events

### "connecting"

```
function(peerInfo, peer) { }
```

Signals that a WebRTC connection process has been initiated.

---

### "connected"

```
function(peerInfo, peer) { }
```

Signals that a WebRTC connection has been established.

---

### "disconnected"

```
function(peerInfo, peer) { }
```

Signals that a WebRTC connection has been closed.

---

### "error"

```
function(errorEvent, peer) { }
```

`errorEvent.error` provides a description of the error. If a general relay error, no other information will exist on `errorEvent`. If specific to an individual peer, the object will include attributes from `peerInfo`.

---

### "accessGranted"

```
function() { }
```

The access token has been validated.

---

### "accessRemoved"

```
function() { }
```

A previously-set access token has been removed.

---

### "accessDenied"

```
function() { }
```

The user denied access to the relay when prompted.

---

### "accessInvalid"

```
function() { }
```

The access token was invalid, typically due to expiration.

---

### "listening"

```
function() { }
```

A stream has been opened to the relay and new connections/traffic will now be accepted.

---

### "notlistening"

```
function() { }
```

The stream to the relay has been closed.

---

### "streamTaken"

```
function() { }
```

The requested stream id is in use, try to connect again with a different ID.