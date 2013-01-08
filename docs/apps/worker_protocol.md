Worker Protocol
===============

pfraze 2013


## Overview

This document discusses how Workers are managed, including the load-process, life-cycle, and communication protocols.

 > [Web Workers](https://developer.mozilla.org/en-US/docs/DOM/Using_web_workers) interoperate through the `postMessage()` interface. [MyHouse](../lib/myhouse.md) provides a base set of tools for building a communication protocol.


## Load Process & Life-cycle

The life of the worker breaks into 4 segments: bootstrap, application load, life, and death.

### Bootstrap

### Application Load

### Life

### Death


## Further Topics

 - [Building an Application](building.md)
 - [Using MyHouse, the Worker manager](../lib/myhouse.md)