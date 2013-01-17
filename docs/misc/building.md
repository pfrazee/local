Building
========

pfraze 2013

 > The current build process and code organization is temporary, pending a better understanding of the production needs for Local. If you have any suggestions, please post them to the [Github Issue Tracker](//github.com/pfraze/local/issues).

Local is currently spread across 5 repositories: [Promises](https://github.com/pfraze/promises), [LinkJS](https://github.com/pfraze/linkjs), [MyHouse](https://github.com/pfraze/myhouse), [CommonClient](https://github.com/pfraze/common-client), and [Local](https://github.com/pfraze/local). This arrangement may change later.

The sub-repositories are embedded, so you need to clone Local recursively if you want them:

```bash
git clone --recursive https://github.com/pfraze/local.git
```

If you make changes to them, you should then run 'make' from within local's directory to have their source concatenated and copied into /lib. Currently, it doesn't minify the output or combine them into a single file.


## Tests

Tests are located within each of the sub-repositories. Assuming the sub-repos have been cloned with local (see above), you can access them at the following URLs:

 - /lib/linkjs/test.html
 - /lib/myhouse/test.html
 - /lib/common-client/test.html

LinkJS uses a NodeJS server to run its remote-request tests against. It can be run by executing `node test-server.js` from the linkjs repository.