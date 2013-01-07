Horizontally-Programmable Protocol
==================================
"deliver us from the host" -Good Practice 4:13

pfraze 2013


## Overview

A website (the "environment") can safely execute a piece of software (the "application") without risking a security leak. This allows two sites to interoperate by delivering applications which consume their APIs.


## Problem Description

Let's say I run a private social network called "FrazeeNet" and I want to send a message to somebody on "FooNet." I can't use email, since email doesn't have a native browser implementation. That leaves web services, so I develop a client for FooNet's API. Now let's say the FrazeeNet user wants to reach "BarNet." What are the odds I can reuse the FooNet client?

There have been some attempts to standardize API designs for that reason, but standards are notoriously difficult to spread, and none have caught on to the extent I would like. As a result, some software development must precede any communication between two end-points, and each client implementation must be maintained in the codebase. Not only does this create a lot of redundant effort, it severly limits the interoperability of our web applications. As a result, networks tend to be limited to their userbase, and are rarely able to reach the member saturation required to provide value.


## Recommended Solution

Local's solution is to deliver a client app for the sender to execute within its interface. A few interoperability standards in the environment should be simpler to implement than service-specific protocols, so this reduces the coordination required. The experience might then run as follows:

 - The FrazeeNet user hits "Compose" and enters the URL of his recipient (eg "https://foo.net/contact/bob")
 - The FrazeeNet environment issues "GET https://foo.net/contact/bob Accept=application/javascript"
 - FooNet responds with an application which provides a contact form, which FrazeeNet runs in a sandbox
 - The user fills out the message and hits send, generating a request back to FooNet
 - The FrazeeNet environment adds an "auth" header to the request
 - FooNet verifies the auth credentials (for instance, via a browserid service)
 - FooNet accepts and delivers the message

Redundant effort is now reduced, as each service is able to develop one or two clients for others to use. More importantly, the sites should have little (if any) friction to communicate, allowing private networks to be effective for consumers.