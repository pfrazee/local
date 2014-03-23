<style>strong { color: gray; }</style>

# In-Application Sandboxing with Web Workers

---

For the past fews years, the Web has been shifting control to the client. Given the limitations of remote services, developers are now looking for ways to ["unhost"](https://unhosted.org/) static applications &ndash; that is, break the dependency on remote servers while still using the Web platform.

One new technology for client-side control is the Web Worker VM. This API lets the Page load, execute, and destroy separate "Worker" threads which use their own Virtual Machines. **By hosting behaviors in Worker Sandboxes, applications can relax constraints on script-origins, shifting development from a centralized SaaS model into a distributed and free (as in freedom) script-sharing model.**

This is article is a recommendation from my personal research. It proposes a novel architecture which is still under evaluation, and so should be carefully considered before production use. Updates will be made as issues are identified and resolved.

Note that 0day attacks against the VM are not part of this architecture's threat-model. As these threats are inherent to the Browser, they are considered out of scope. However, in highly security-sensitive applications, more restrictive policies (such as prior auditing of all scripts) can be applied.

### Using Worker VMs to execute Untrusted Code

Virtual Machines are the technology that Browsers use to keep Pages from attacking the rest of your computer with Javascript. Their APIs give limited access to the machine (some screen space, some storage space, XHR, etc) and are generally well-hardened against exploits. Using them has allowed the Browser to navigate the Web freely, without auditing Pages before opening them.

In this model, if users are allowed to add Javascript to the page, it will result in a security breach. **This is an issue of "application integrity."** Security decisions are made assuming the page's javascript comes from the same origin, and so there are no barriers between scripts within the Page's VM. Malicious code could steal privileged information, impersonate the user, or launch network attacks. Therefore, users are not free to share scripts with each other.

**Unfortunately, IFrames do not solve this issue**. Though they do use seperate VMs, IFrames share the Page thread. Attackers can enter infinite loops to block during the Page's allocated CPU-time &ndash; a Denial of Service Attack. Therefore, IFrames must be conservative about the scripts they load. ([Google Caja](https://code.google.com/p/google-caja/) suffers from [this same vulnerability](https://groups.google.com/forum/#!topic/google-caja-discuss/RAi-hHiClRA).)

**By executing in a VM in a separate thread, Web Workers preserve app integrity and Page-thread CPU-allocation.** This protection is similar to that of multiple active Web Pages within the same Browser, and so protects the integrity of the Page (and of other Workers). Additionally, attacks which impersonate the Page or leak privileged information can be mitigated by restricting the APIs available to the Workers.

### Using CSP to create a Trusted Kernel

<a href="https://developer.mozilla.org/en-US/docs/Security/CSP">Content-Security Policies</a> place tight restrictions on the origins of resources loaded into the Page. **By restricting the script origins to non-inlined, non-evalled scripts from the Page Host, and by using TLS to deliver the scripts, the Page can provide a strong guarantee that its VM will only execute trusted software.** This guarantee can be improved by hosting from the local machine.

Additional policies can be used to restrict malicious behaviors such as data-leaking or user-tracking through embedded image URLs. This trade-off should be considered by the application; in non-sensitive data environments, the policies may be relaxed. IFrames also provide a means to contain styles and malformed HTML, and so may allow inline styling.

**By reducing the Worker API to `postMessage`, we can restrict the Worker to communicating only with its Host Page, then rely on the Host Page to audit and enact (or discard) all of the Workers' actions**. In an effective execution, this would provide "data-containment," meaning Workers could receive privileged information and be trusted not to leak it. At present, this is accomplished in Local.js by injecting the following script into the Worker before executing its application code:

```javascript
(function() {
  var nulleds=[];
  var whitelist = [ // a list of global objects which are allowed in the worker
    'null', 'self', 'console', 'atob', 'btoa',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'Proxy',
    'importScripts', 'navigator',
    'postMessage', 'addEventListener', 'removeEventListener',
    'onmessage', 'onerror', 'onclose',
    'dispatchEvent'
  ];
  for (var k in self) {
    if (whitelist.indexOf(k) === -1) {
      Object.defineProperty(self, k, { value: null, configurable: false, writable: false });
      nulleds.push(k);
    }
  }
  var blacklist = [ // a list of global objects which are not allowed in the worker,
                    // and which dont enumerate on `self` for some reason
    'XMLHttpRequest', 'WebSocket', 'EventSource',
    'FileReaderSync',
    'Worker'
  ];
  blacklist.forEach(function(k) {
    Object.defineProperty(self, k, { value: null, configurable: false, writable: false });
    nulleds.push(k);
  });
  if (typeof console != "undefined") { console.log("Nullified: "+nulleds.join(", ")); }
})();
// application code follows...
```

This approach is still being evaluated. Ideally, Browsers should offer an API for restricting Worker capabilities. [CSP 1.1](http://www.w3.org/TR/2014/WD-CSP11-20140211/) enables per-Worker policies through their own Content-Security-Policy response headers, but this would require all Workers to serve from a trusted Host.

Another issue still under evaluation is `importScripts`, which (like image embeds) could be used for data-leaking and user-tracking. At present, another injected script restricts imports to the Worker's origin, and disables the function after the first execution &ndash; before any application messages are delivered with potentially sensitive information. If this strategy is ineffective, it may be necessary to disable importScripts and rely on self-contained bundles. Alternatively, a module system (such as [Browserify](http://browserify.org/)) could be managed by the Host Page.

### The Advantages of Worker Sandboxing

Pages aren't able to discover and leverage each other within the Browser. Workers, however, are allowed to message with the Page, and, by proxy, other Workers. **This means the Host Page can play the role of an "Environment" &ndash; a sort of miniature OS &ndash; and ferry messages between the Workers as well as interpret the messages into application behavior.**

Extension-based architectures have been used successfully in numerous offline contexts. Microsoft Excel's declarative, cell-based language has made it a leader in business intelligence. Emacs is famous for its plugins-based architecture which has given it 38 years of life and enormous range. CAD programs and IDEs (including LightTable and SublimeText) use plugins to generate data or add features, and video games have sustained rich second markets through mods. **User extension, used well, is a value-adding feature.**

In addition to opening opportunities, in-application sandboxing solves some standing issues in the Web.

**Example 1**

Mint.com, a financial-planning application, requires third-party access to your purchasing history, balances, and banking info. Because the Web lacks a way for Mint to discover and import user data within the client, the data-import must occur at their remote servers. This illustrates a lack of "data containment."

A more appropriate design would detach the Mint application from its host, give it access to the banking data and a portion of the GUI, and restrict any additional behaviors (such as Web access). Mint's purpose is to generate charts and reports on the dataset, and so it's a strong candidate for this kind of containment. Using Worker Sandboxes, a banking site could run the Mint program and give users a safe way to execute against their own information.

**Example 2**

Facebook made a play in 2008-11 to become an applications platform, but found themselves stalled by the Web's limitations. The applications had to run in iframes on isolated pages, and could only interact with the rest of the site through media &ndash; posting to the Feed and or reading from the Friends API. Facebook was also unable to provide data-containment, and so apps could send userdata away to a third party.

Without a container like the Worker, Facebook can only share interpretted media (images, video) and can not let users rewrite core functions in the application. By moving core behaviors into Workers which users can change, Facebook would enable users to make their own decisions about privacy and GUI design. This would go a long way toward increasing the longevity of their software.

### How do the Workers integrate with the page?

Refer to [Communicating with Web-Workers using HTTP](#docs/communicating-with-web-workers-using-http.md) to read about protocol decisions, and [Applying User-Agent Behaviors in Web Applications to Enable Runtime Extension](#docs/applying-user-agent-behaviors.md) for an explanation of the interfacing process.

~pfrazee
