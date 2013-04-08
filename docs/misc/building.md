Building
========

pfraze 2013

Local can be found at [https://github.com/grimwire/local](https://github.com/grimwire/local). During development, you can include `/lib/local.dev.js`, which includes the files without concatenation or minification. For production, include `/lib/local.min.js` after running `make`.


## Tests

Tests are located under the `/test` folder. You can access them at the following URLs:

 - /test/linkjs.html
 - /test/myhouse.html
 - /test/common-client.html

LinkJS uses a NodeJS server to run its remote-request tests against. It can be run by executing `node test-server.js` from the linkjs repository.