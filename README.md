## LinkShell

LinkShell is an attempt to build a more complete HTML5 operating environment. Its goals are to:

 - Structure safe interactions between isolated applications within a shared document
 - Connect remote services through the browser session without exposing them to each other
 - Provide an simple & powerful interface for managing sessions and composing application behavior

LinkShell works by extending the [Service-Oriented Architecture](http://en.wikipedia.org/wiki/Service-oriented_architecture) into the document: [an Ajax library](//github.com/pfraze/linkjs) allows Javascript modules to respond to requests. It then sandboxes portions of the document into Agents which run applications and manage connectivity to remote services.

The Agents are simultaneously clients and servers. As clients, they give interfaces to their applications. They may provide inboxes, calendars, editors, widgets, and so on. As servers, they serve the resources to their application and the environment. If the Agent's application is to provide a runtime tool like a text editor, its server will host resources like `/lines/2-30` and `/revisions`. If the Agent's application is to control connectivity to a service like email or facebook, its server will host proxies with resources like `/messages`. In practice, most servers will be some hybrid of local state & remote proxies.

This mechanism allows agents to mask remote services from each other. Rather than connecting to `gmail.com`, programs talk to the "mail" agent at `/mail`. The mail agent server will route the message to gmail, and its client interface will give the user chances to modify or approve the transaction if needed. Policies are set on each agent to control the software they load and which agents can talk to them. If the user wants to shut down all email, they can just close the mail agent.

This approach helps the user get a direct view of the environment's composition, as the presence and state of an agent determines the system's behavior. When connectivity needs to change, the user can load a new program into the agent, or alter the settings of an existing program. For instance, a user could switch from home to work scheduling by loading the office's outlook program into the calendar agent.

Agents are allowed to create subagents which they control through policies and some limited APIs. This allows agent clients and servers to be composed of multiple independent programs, which contains complexity if there are many similar services (for instance, 15 messengers) that can be merged into one. It can also help build dynamic tools, as the user can drag in the interfaces they need.

Drag-and-drop is, currently, the dominant user interaction. Links and form buttons are dragged to the agents which are meant to execute the request and interpret the response. This allows for dynamic configuration between programs as the user directs them to consume services from each other.

---

*LinkShell is in early beta, so expect runtime, API, and design instability.*

---

## License

The MIT License (MIT)
Copyright (c) 2012 Paul Frazee

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
