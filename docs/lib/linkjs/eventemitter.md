Link.EventEmitter
=================

pfraze 2013


## Overview

`EventEmitter` fulfills the common task of pubsub for Local. It follows the NodeJS API to a large degree.


## API

### emit( <small>eventName, args...</small> ) <small>=> true/false</small>

Returns `false` if no handlers are registered to the `eventName` and `true` otherwise.

### on/addListener( <small>eventName, listenerFn</small> ) <small>=> this</small>

### once( <small>eventName, listenerFn</small> ) <small>=> undefined</small>

### removeListener( <small>eventName, listenerFn</small> ) <small>=> this</small>

### removeAllListeners( <small>eventName</small> ) <small>=> this</small>