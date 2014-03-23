<style>strong { color: gray; }</style>

# Communicating with Web-Workers using HTTP

---

Web Workers interact with their Host Pages using a messaging channel (the `postMessage` API). Crucially for their programming model, the messages are asyncronous. This introduces a significant challenge for implementing Page APIs within a Worker &ndash; for instance, how do you port a GUI widget from the Page (where it can access the DOM) to a Worker, where it can only send async messages?

In my experience, two categories of solutions are suggested: use code-transformations to recreate Page-native APIs in the Worker, or introduce a new interface around messaging. **In this article, I'll explain why code transformations don't address the problem fully, and present a complete messaging solution based on HTTP.**

### What are the requirements?

 1. Web Workers' basic requirement is to serve APIs for the Host Page. Broadly speaking, this should include serving GUI elements and data-processing APIs.
 2. Because Workers use a different trust profile than the Host Page, their actions must be subject to permissions models.
 3. Because Workers are not pre-orchestrated by the Host Page (they are chosen at runtime by users), they must be able to discover and configure into their environment (which includes using other Workers).

### Code-transformations don't address the problem

The premise behind code transformations is to hide the async messaging behind functions which mimic the Page's syncronous APIs. The script is then parsed, and the "syncronous" APIs are replaced with callback-based async equivalents.

Workers are especially well-suited for these transformations because they are loaded by application code which can apply the transformation step. Developers no longer have to use 'watch' tools to autocompile; refreshing the page is guaranteed to use the latest script.

**However, transformed calls are going to become messages regardless of how they're presented to the Worker.** The most direct solution then is to use some form of serialized RPC which translates directly to functions in the Host Page, not unlike in [Oasis.js](http://oasisjs.com/). However, because memory references can not transfer, the Host Page would be required to hold the non-transferrable objects in memory in order to expose their APIs and state. This introduces complex questions about object lifetime and shared state which are further complicated by inter-Worker calls.

**By instead focusing on the message channel as a novel interface, we gain opportunities to introduce [new characteristics](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm) into the system.** Among these are cacheability, composable Worker pipelines, network abstraction, and hypermedia-based configuration.

### Abstracting Workers as Web servers

Though this concept initially surprises developers, there's no reason for it to cause confusion. The `postMessage` API is used exactly as a TCP socket might be, and, like TCP, it's reliable and guarantees order.

In practice, I've used a [JSON-encoded variant of HTTP/1.1 called HTTPL](#docs/en/0.6.2/httpl.md) in order to take advantage of the browser's native JSON de/serialization performance. It's a very simple format - literally an object with .path, .headers, .method, and so on. The requests are routed by hostname to handler functions. (Notably, HTTPL differs from HTTP by being full-duplex.)

**Using the Web server model creates an Ajax interface to the Worker which mimics XHR.** The Workers are addressed through a new URL scheme (httpl://) and handle the requests using stream APIs similar to those in Node.js.

### Why use HTTP?

 - It is an established and well-documented specification which developers know.
 - Many design decisions are answered by following standards, and doing so retains the Web's native "style."
 - HTTP creates uniformity between Workers and Remote Services, and enables the Workers to host over WebRTC.
 - HTTP introduces request/response transactions (streams) which are critical for certain kinds of interactions.
 - HTTP can compose into Proxy Pipelines and Round-Trip Pipelines, both with unique purposes.
 - HTTP supports automated configuration through Hypermedia.

### Uniform Network Interface

Using the Ajax interface unifies XHR with the Workers, effectively establishing the Page, its Workers, and the Web as a distributed system. This simplifies configuration and reduces the importance of where a component is hosted.

As WebRTC is deployed, HTTP can be used to connect Pages and their Workers. This enables Workers to host for other users across the network as well as to the local Page.

### Request/Response Transactions (Streams)

Streams can be used to enforce order and to share state with a defined lifetime for a specific transaction. Request/response streams reliably teardown if one party exits prematurely due to the broken link. Their use can be viewed as parallel to that of [RAII](http://en.wikipedia.org/wiki/Resource_Acquisition_Is_Initialization) in C++.

In cases where the overhead of HTTP is more than is needed, or where some state must be briefly shared, request transactions can be used to stream commands. This is illustrated in a [network interface for jQuery](https://github.com/pfraze/nquery).

### Unix-style Pipelines

Stream composition is a key tool for data processing and system configuration. HTTP supports two forms of pipelines.

 - Proxy Pipelines: proxies are sent requests for downstream services (for instance, http://myproxy.com/the-downstream.com). Can be expressed with a single URL, but relies on non-universal proxy behaviors, and so can't apply in all cases.
 - Round-trip Pipelines: standard hosts are sent requests with bodies from previous responses in the pipeline. Each step is a full round trip which returns to the client, then streams out to the next host.

In appropriate scenarios, both of these techniques can be used to compose Worker behaviors. Proxies, however, are most commonly used to bridge between environments. For instance, the Page acts as a proxy between Workers, and from a Worker to a Public Web Host.

### Automating Configuration with Hypermedia

Workers must be able to discover and use each others APIs. Past attempts in this area, eg SOAP/WSDL, became overly complex by attempting to describe interface behaviors. Instead, typed links can be used to succinctly label API endpoints.

The [Link Header Field](http://tools.ietf.org/html/rfc5988#section-5) serializes a list of links which are identical to the HTML `<link>` element (commonly used `<link rel="stylesheet" href="...">`). They are also similar to the links in JSON-HAL. They represent relationships from the current "context" (meaning the URL they were fetched from). The relation type (reltype) encodes expected behaviors, enabling clients to make assumptions about the endpoint. Other metadata KVs (title, id) communicate related details.

Clients fetch the Link header with the HEAD request, then query against the list to find endpoints which meet their requirements. Programs can leverage this querying process to narrow the options for users, like how File-picker Dialogs narrow choices by file-extension. This index-querying process drives configuration, potentially allowing new Workers to discover where they belong and "just work."

Read [Applying User-Agent Behaviors in Web Applications to Enable Runtime Extension](#docs/applying-user-agent-behaviors.md) to learn more about this process.

~pfrazee