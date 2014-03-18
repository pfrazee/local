# In-Application Sandboxing with Web Workers

---

For the past fews years, the Web has been shifting control to the client. Given the limitations of remote services, developers are now looking for ways to ["unhost"](https://unhosted.org/) static applications &ndash; that is, break the dependency on remote servers while still using the Web platform.

One untapped technology for client-side control is the Web Worker Sandbox. This API lets the Page load, execute, and destroy separate Worker threads which use their own Virtual Machines. By using Worker Sandboxes to drive behavior, the Web can give users the choice of which software they run together, shifting development from a centralized SaaS model into a distributed and free (as in freedom) script-sharing model.

### Worker Sandboxes to Safe-Execute Untrusted Code

Virtual Machines are the technology that Browsers use to keep Pages from attacking the rest of your computer with Javascript. Their APIs give limited access to the machine (some screen space, some storage space, XHR) and are generally well-hardened against exploits. Using them has allowed the Browser to navigate the Web freely, without auditing Pages before opening them.

Now currently, if you let users post live Javascript to each other &ndash; perhaps with a forum that ran user-uploaded Widgets &ndash; how would that end? Not well, of course. A malicious user could use the script to hijack somebody else's application. Why is that?

Even though the VM keeps your computer safe from the attacker's script, it can't stop the script from corrupting other code *within* the VM. This means all behaviors of the Page are potentially compromised when 3rd-party code is freely included.

Unfortunately, another VM isn't enough to solve this, or else we could just use iframes (which do execute their JS in seperate VMs). The problem with the iframe is that it shares the Page thread. If a script wanted to attack the Page, it could enter infinite loops that stall out the CPU &ndash; a Denial of Service Attack. Therefore, iframes must be conservative about the pages they load. ([Google Caja](https://code.google.com/p/google-caja/) suffers from [this same vulnerability](https://groups.google.com/forum/#!topic/google-caja-discuss/RAi-hHiClRA).)

By executing in a VM in a separate thread, Workers remove the restrictions on where the script originates. After reducing the worker API to `postMessage`, we can expect the worker to only communicate with its Host Page, and rely on the Host Page to audit and enact (or discard) all of the Workers' actions. Like browsing the Web, Applications can then freely load scripts without auditing them ahead of time. Users are free to contribute their own Widgets and APIs for the community to use.

Because Workers can be created and destroyed at runtime, the user can swap them and reconfigure for a specific use-case. By moving behavior-driving components into the Workers, applications give users control over core behavior. This control includes choosing which remote endpoints to use, and, in a well thought-out execution, users could integrate private hosts into the public application's network using the Workers.

### The Page as a Platform

A Web Worker is similar to a Web Page. It delivers on-demand, and executes in a VM. However, Workers are invisible and owned by Pages. There, within that environment, they provide APIs which the Page can choose to leverage.

Pages aren't able to discover and leverage each other within the Browser. Workers, however, are allowed to message with the Page, and, by proxy, other Workers. This means the Host Page can play the role of an "Environment" &ndash; a sort of miniature OS &ndash; and let the user choose which Workers are loaded. Then, it can ferry messages between the Workers as well as interpret the messages into application behavior.

Extension-based architectures have been used successfully in numerous offline contexts. Microsoft Excel is notorious for its declarative, cell-based language which now drives a number of business' finances. Emacs is also famous for its plugins-based architecture which has given it 38 years of life and enormous range. CAD programs and IDEs (including LightTable and SublimeText) use plugins to generate data or add features, and video games have sustained rich second markets through mods. User extension, when used well, is a value-adding feature.

The Worker Sandbox differentiates from those examples through its VM. In a social environment like the Web, the plugins can be shared in forums, aggregators, follower feeds, etc, then deployed for users without an installation process. This opens the possibilities for crowd development, where communities exchange scripts and configuration to build their software collaboratively. The Host Page provides the scaffolding while the users dictate the final experience.

### Worker Sandboxing Enables Privacy and Innovation

In addition to opening opportunities, in-application sandboxing solves some standing issues in the Web.

*Example 1*

Mint.com, a financial-planning application, requires third-party access to your purchasing history, balances, and banking info. Because the Web lacks a way for Mint to discover and import user data within the client, the data-import must occur at their remote servers. This illustrates a lack of "data containment."

A more appropriate design would detach the Mint application from its host, give it access to the banking data and a portion of the GUI, and restrict any additional behaviors (such as Web access). Mint's purpose is to generate charts and reports on the dataset, and so it's a strong candidate for this kind of containment. Using Web Worker Sandboxes, a banking site could run the Mint program and give users a safe way to execute against their own information.

*Example 2*

Facebook made a major play in 2008-11 to become an applications platform, but found themselves stalled by the Web's limitations. The applications had to run in iframes on isolated pages, and could only interact with the rest of the site through media &ndash; posting to the Feed and or reading from the Friends API. Facebook was also unable to provide data-containment, and so apps could send userdata away to a third party.

Without a container like the Worker, Facebook can only share interpretted media (images, video) and can not let users rewrite core functions in the application. By moving core behaviors into Workers which users can change, Facebook would enable users to make their own decisions about privacy and GUI design. This would go a long way toward increasing the longevity of their software.

### Are Workers Effective Sandboxes?

[OWASP actually advises against running user code in Workers](https://www.owasp.org/index.php/HTML5_Security_Cheat_Sheet#Web_Workers). The rational they give is, "malicious Web Workers can use excessive CPU for computation, leading to Denial of Service condition." I'm unconvinced by this line of reasoning because, as far as I can tell, the Page is no different. They also explain, "Web Workers are allowed to use XMLHttpRequest object to perform in-domain and Cross Origin Resource Sharing requests." This is currently so, but [Content Security Policies 1.1](http://www.w3.org/TR/CSP11/#processing-model) will let the application shut off XHR for the Worker.

Web Workers are VMs which, unlike iframes, are in separate threads. In the right configuration, they can be restricted to only messaging the Host Page. The Page audits messages and attaches origin information for other Workers to make access decisions. So long as the Page itself remains uncorrupted (through a combination of CSPs, iframes, and sanitation) the Workers should not be able to break the underlying assumptions.

### How do the Workers integrate with the page?

Refer to [Communicating with Web-Workers using HTTP](#docs/communicating-with-web-workers-using-http.md) to read about protocol decisions, and [Applying User-Agent Behaviors in Web Applications to Enable Runtime Extension](#docs/applying-user-agent-behaviors.md) for an explanation of the interfacing process.

~pfrazee
