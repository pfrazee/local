Using Grimwire
==============

[<a href="http://grimwire.com">Official Site</a> | <a href="https://github.com/grimwire/grimwire">Repository</a>]

---

Grimwire is a signalling relay for establishing WebRTC connections between peers. It includes a link index for peer discovery, and HTTPL traffic "bouncing" as a fallback transport. It was designed to work with Local.js, but can be used in other applications as well.

## Joining a Relay

Starting a session with a Grimwire relay is a two-step process:

 - First, the application must request an access token, which the user authorizes in a popup.
 - Second, the application must establish an event-stream with a unique stream ID.

If the stream ID is taken - presumably by another instance of the application - the relay will respond '409 Conflict', and you must try again with a new ID.

```javascript
// Get access to the relay
var streamId = 0;
var relay = local.joinRelay('https://grimwire.net', { stream: streamId }, peerServerFn);

// Handle authorization
relay.requestAccessToken(); // this will prompt the user to authorize the app
relay.on('accessGranted', function() {
    peerRelay.startListening(); // acquires a stream
});
relay.on('accessDenied', function() {
	alert('Hey user, what gives?');
});

// Deal with stream conflicts
relay.on('streamTaken', function() {
	relay.setStreamId(++streamId);
	peerRelay.startListening();
});

// Update relay-connectivity status
relay.on('listening', function() {
	alert('Connected to the relay!');
});
relay.on('notlistening', function() {
	alert('Disconnected from the relay!');
});

// Handle requests
function peerServerFn(req, res, peer) {
	// ...
}
```

Once you've acquired a stream, your application will be assigned a URL and peers can begin sending requests to you. You can stop accepting new connections with `relay.stopListening()`, but any existing WebRTC connections will persist.

Note, if you don't need a specific stream ID, you can leave the value undefined and Local.js will generate a random numbers until a unique number is found.

---

## GrimWidget.js

To simplify the connection process, <a href="https://github.com/grimwire/grimwire">Grimwire includes grimwidget.js</a> (<a href="https://raw.github.com/grimwire/grimwire/master/grimwidget.js">Direct Link</a>) to use in applications. The Grimwidget gives a popup interface for inputting the relay URL and rendering links in the relay's index.

```javascript
grimwidget.create({
	triggerEl: document.querySelector('#conn-status a'),
	halign: 'right'
});
var relay = grimwidget.getRelay();
```

<a href="#docs/grimwidget.md">&raquo; GrimWidget.js</a>

---

## URL Assignment

Grimwire assigns a globally unique URL to every active stream using 4 pieces of information.

<strong>httpl://<span style="color: rgb(216, 56, 56)">bob</span>@<span style="color: rgb(81, 129, 201)">grimwire.net</span>!<span style="color: rgb(81, 160, 37)">chat.grimwire.com</span>!<span style="color: rgb(216, 149, 31)">123</span>/</strong>

 1. <strong style="color: rgb(216, 56, 56)">User</strong>: the id of the account authenticated with the relay
 2. <strong style="color: rgb(81, 129, 201)">Provider Domain</strong>: the relay hosting the peer stream
 3. <strong style="color: rgb(81, 160, 37)">App Domain</strong>: the hostname of the application using the stream
 4. <strong style="color: rgb(216, 149, 31)">Stream ID</strong>: the id of the app's stream to the relay (optional if 0)

Any request sent to an HTTPL address matching this scheme will automatically route to the peer (establishing a WebRTC connection in the process).

 - If the application is not connected to the target peer's relay, the request will receive a 407 (Proxy Authentication Required).
 - If the target peer is not online, the request will receive a 404.

---

## Getting Peer Information

Peer server functions are given a third `peer` parameter which maps to the `RTCBridgeServer` instance for the peer. You can query it to determine the origin of the message.

```javascript
function peerServerFn(req, res, peer) {
	console.log(peer.getPeerInfo());
	/* =>
	{
		domain: 'bob@grimwire.net!chat.grimwire.com!123',
		user: 'bob',
		relay: 'grimwire.net',
		app: 'chat.grimwire.com',
		stream: '123'
	}
	*/
}
```

---

## Registering Links

Applications can register links with the relay's index for other peers to discover. As with response headers, any relative paths will have the hostname of the peer prepended.

```javascript
relay.registerLinks([
	{ href: '/', rel: 'service foobar.com/myservice', title: 'My Foobar Service' }
]);
```

To query the current index, use the relay's `agent()` function:

```javascript
relay.agent().follow({ rel: 'foobar.com/myservice' }).get();
```

Links automatically have the `relay_user` attribute populated with the id of the registering user. Additionally, when the link header is parsed, peer URIs have the `host_user`, `host_app`, `host_relay`, and `host_stream` attributes populated so that navigations can query against those values.

```javascript
relay.agent().follow({ rel: 'foobar.com/myservice', relay_user: 'bob' }).get();
```

---

## Traffic Bouncing

In some situations, users will not be able to establish direct connections to each other. This will happen frequently before WebRTC has fully deployed, but may continue afterward due to firewalls and symmetric NATs. The solution, <a href="http://en.wikipedia.org/wiki/Traversal_Using_Relays_around_NAT">the TURN Protocol</a>, uses a public server to relay messages between the users (peer-to-relay-to-peer). In Grimwire, this is called "bouncing."

Grimwire currently implements its own bouncing protocol, but may switch to TURN in the future. Users are guaranteed that all bouncing will occur through their relay service, and not through any third-party. In the future, Local.js will include options to disable bouncing for cases where more privacy is required.