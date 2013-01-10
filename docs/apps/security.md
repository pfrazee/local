Worker Security
===============

pfraze 2013

## Overview

This document discusses the security model used in Local for executing untrusted code. It will cover Local's use of Web Workers and mediated messaging.


## Introduction

Local uses Web Workers for sandboxing, as they allocate isolated namespaces and (unlike iframes) run in separate threads. Before loading the user program, dangerous APIs (XMLHttpRequest, importScripts) are nulled, and a standard library & program-scaffold are loaded. The 'postMessage' API is extended with an named protocol which is then used for program control. HTTP requests are built on top of this, using unique message IDs to map response messages to their original requests.

For messaging and addressing, Local uses an SOA: its in-document programs host HTTP-style services to expose public interfaces. Requests targeting the "HTTP Local" protocol (httpl://) are routed to these in-document services. Interactions are then driven through links, forms, and Ajax calls.

 > Note: the local services do not host actual TCP servers; rather, they respond to a messaging system within the Local document which emulates the features of HTTP.

User programs are loaded into Workers and operate as Web Servers for their entire lifetime. The document is then divided into "Client Regions", which behave as independent browsing contexts (much like iframes). Their DOM events are captured and translated into custom "Request" DOM events, which are then caught by the environment. The environment decides whether the request should be dispatched, and makes any neccessary changes as it does. The response then replaces the target element of the request.

The environment may post-process DOM updates to add widgets or custom behavior, though that should be the exception.


## Web Workers

Workers are used to sandbox the user programs. They may be loaded remotely or from strings, and are provided a configuration object at load (which includes their assigned domain). They are allowed to import new scripts, but they can only make remote requests through the environment.


## Traffic Mediation

### Remote Sessions

The environment is responsible for managing remote sessions while keeping sensitive data from leaking into user programs. It accomplishes this by adding or removing headers such as 'Auth' and 'Set-Cookie'.

### Permissions

Connectivity policies can be enforced by examining request origins and destinations. The policy is up to the environment definition. For instance, an environment might proxy all remote traffic througha "gateway program" which requires user confirmation.


## Document

The document contains all session state and, as is typical, should not load untrusted software. In order to ensure this, Content Security Policies are set to restrict inline javascript.


## Further Topics

 - [Building an Application](building.md)
 - [Mediating Traffic for Security and Privacy](../env/mediating_traffic.md)
 - [Adding Widgets and Client Behaviors](../env/adding_widgets.md)