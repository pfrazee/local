Adding Widgets and Client Behaviors
===================================

pfraze 2013


## Overview

After any request updates the document, `Environment.postProcessRegion()` is called with the containing element as the first parameter. Use this opportunity to add any widgets or event handlers your environment requires.

```javascript
Environment.postProcessRegion = function(elem) {
	addMyCustomCtrls(elem);
	addOtherCustomWidgets(elem);
};
```


## Further Topics

 - [DOM Interactions via the Common Client](../apps/dom_behaviors.md)
 - [Using CommonClient, the standard DOM behaviors](../lib/commonclient.md)
 - [Using the Environment API](../lib/environment.md)