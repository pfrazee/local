PageServer
==========

Descends from `local.BridgeServer`. Provides request/response exchange over connections to the page.

Automatically created and assigned a URL on connect. The URL follows the scheme of `<page_id>.page`. For instance, the hostpage can be reached at 'httpl://0.page'.

## local.PageServer

### .id

A number, the index assigned to the page on connection. This host page will always have an id of 0.

### .isHostPage

A boolean, is this the page that created the worker?