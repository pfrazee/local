# Change Log

## [Unreleased](https://github.com/pfraze/local/tree/HEAD)

[Full Changelog](https://github.com/pfraze/local/compare/0.6.2...HEAD)

**Implemented enhancements:**

- Fix binary support [\#115](https://github.com/pfraze/local/issues/115)

- Change host.page to host.env [\#105](https://github.com/pfraze/local/issues/105)

- Add new parameter to dispatch sugars [\#104](https://github.com/pfraze/local/issues/104)

- Add ok\(\), redirect\(\), err\(\), failure\(\) sugars for writeHead\(\) to Response [\#103](https://github.com/pfraze/local/issues/103)

- Request aliases - uri, params, q [\#101](https://github.com/pfraze/local/issues/101)

- Add local.makeDataUri\(str, type\) [\#98](https://github.com/pfraze/local/issues/98)

**Fixed bugs:**

- Client dispatch needs to return request object, not a promise [\#111](https://github.com/pfraze/local/issues/111)

- nextTick needs to skip non-next-tick messages [\#87](https://github.com/pfraze/local/issues/87)

## [0.6.2](https://github.com/pfraze/local/tree/0.6.2) (2014-03-15)

[Full Changelog](https://github.com/pfraze/local/compare/0.6.1...0.6.2)

**Implemented enhancements:**

- Give a descriptive error message when workers attempt to make http/s requests [\#93](https://github.com/pfraze/local/issues/93)

- Reimplement the self.main interface in workers [\#91](https://github.com/pfraze/local/issues/91)

- Require a preceding slash in source-path fragments [\#89](https://github.com/pfraze/local/issues/89)

**Closed issues:**

- importScripts should be disabled after a Worker is loaded [\#92](https://github.com/pfraze/local/issues/92)

## [0.6.1](https://github.com/pfraze/local/tree/0.6.1) (2014-02-19)

[Full Changelog](https://github.com/pfraze/local/compare/0.6...0.6.1)

## [0.6](https://github.com/pfraze/local/tree/0.6) (2014-02-05)

[Full Changelog](https://github.com/pfraze/local/compare/v0.5.1...0.6)

**Implemented enhancements:**

- Replace promises with bluebird [\#73](https://github.com/pfraze/local/issues/73)

**Fixed bugs:**

- Streams need to periodically clear their buffers [\#86](https://github.com/pfraze/local/issues/86)

## [v0.5.1](https://github.com/pfraze/local/tree/v0.5.1) (2013-12-05)

[Full Changelog](https://github.com/pfraze/local/compare/v0.5...v0.5.1)

**Fixed bugs:**

- queryLinks should correctly handle null query attrs [\#84](https://github.com/pfraze/local/issues/84)

## [v0.5](https://github.com/pfraze/local/tree/v0.5) (2013-11-20)

[Full Changelog](https://github.com/pfraze/local/compare/v0.4...v0.5)

**Implemented enhancements:**

- Add "host" to requests [\#80](https://github.com/pfraze/local/issues/80)

- Restructure source and use browserify to build [\#79](https://github.com/pfraze/local/issues/79)

- Add tests for binary requests over HTTP/S [\#60](https://github.com/pfraze/local/issues/60)

**Fixed bugs:**

- Agents can't stream in some situations [\#81](https://github.com/pfraze/local/issues/81)

- Safari 'postMessage' not defined in Workers [\#54](https://github.com/pfraze/local/issues/54)

## [v0.4](https://github.com/pfraze/local/tree/v0.4) (2013-11-06)

[Full Changelog](https://github.com/pfraze/local/compare/v0.3.1...v0.4)

**Implemented enhancements:**

- Rename handleHttpRequest to handleWebRequest [\#71](https://github.com/pfraze/local/issues/71)

- Allow local.env.addServer to take a function as well as an object [\#70](https://github.com/pfraze/local/issues/70)

- Let responses default their content-type to json if none is given [\#69](https://github.com/pfraze/local/issues/69)

- When no scheme is given, default to local instead of http/s [\#68](https://github.com/pfraze/local/issues/68)

- Add rel protocol [\#67](https://github.com/pfraze/local/issues/67)

- Replace existing HTTPL protocol with HTTP/2.0 [\#63](https://github.com/pfraze/local/issues/63)

- Add request.abort\(\) [\#61](https://github.com/pfraze/local/issues/61)

- Add content-length calculation on response [\#59](https://github.com/pfraze/local/issues/59)

- Solidify request/response header de/serialization [\#58](https://github.com/pfraze/local/issues/58)

- Add timeout controls to dispatch\(\) [\#57](https://github.com/pfraze/local/issues/57)

- Add 1xx response handling [\#44](https://github.com/pfraze/local/issues/44)

**Fixed bugs:**

- EventStream isnt waiting for \r\n\r\n to begin handling [\#66](https://github.com/pfraze/local/issues/66)

- Worker needs to only dispatch requests it can serialize [\#64](https://github.com/pfraze/local/issues/64)

- Worker source is truncated by getSource\(\) [\#55](https://github.com/pfraze/local/issues/55)

- \[Chrome\] EventSource CORS is broken [\#45](https://github.com/pfraze/local/issues/45)

## [v0.3.1](https://github.com/pfraze/local/tree/v0.3.1) (2013-05-19)

[Full Changelog](https://github.com/pfraze/local/compare/v0.3.0...v0.3.1)

## [v0.3.0](https://github.com/pfraze/local/tree/v0.3.0) (2013-05-17)

[Full Changelog](https://github.com/pfraze/local/compare/v0.2.2...v0.3.0)

**Implemented enhancements:**

- Change navigator to use {id} instead of {title} [\#50](https://github.com/pfraze/local/issues/50)

- investigate removing app.postMessage\('loaded'\) from worker apps [\#37](https://github.com/pfraze/local/issues/37)

**Fixed bugs:**

- \[Firefox\] Not enough arguments to removeEventListener [\#52](https://github.com/pfraze/local/issues/52)

- \[Firefox\] No response headers on CORS [\#43](https://github.com/pfraze/local/issues/43)

**Merged pull requests:**

- Change html-deltas to an ordered array notation [\#53](https://github.com/pfraze/local/pull/53) ([pfraze](https://github.com/pfraze))

- Standardize request.path [\#51](https://github.com/pfraze/local/pull/51) ([pfraze](https://github.com/pfraze))

- Standardize request.method as all caps [\#49](https://github.com/pfraze/local/pull/49) ([pfraze](https://github.com/pfraze))

- Deprecate local.http.ext.\* and merge usable pieces into the rest of the codebase [\#48](https://github.com/pfraze/local/pull/48) ([pfraze](https://github.com/pfraze))

- Broadcaster needs to listen for the close of its response stream and release on trigger [\#47](https://github.com/pfraze/local/pull/47) ([pfraze](https://github.com/pfraze))

- ReflectorServer loses worker config on reloads [\#46](https://github.com/pfraze/local/pull/46) ([pfraze](https://github.com/pfraze))

- Unify the Local namespace [\#42](https://github.com/pfraze/local/pull/42) ([pfraze](https://github.com/pfraze))

- Add navigator.subscribe\(\) [\#41](https://github.com/pfraze/local/pull/41) ([pfraze](https://github.com/pfraze))

- Remove navigator HEAD request when not needed [\#40](https://github.com/pfraze/local/pull/40) ([pfraze](https://github.com/pfraze))

- Add the "application/html-deltas+json" response type behaviors [\#39](https://github.com/pfraze/local/pull/39) ([pfraze](https://github.com/pfraze))

- Replace output element SSE subscribe behaviors with data-subscribe [\#38](https://github.com/pfraze/local/pull/38) ([pfraze](https://github.com/pfraze))

- tighten importScripts security [\#35](https://github.com/pfraze/local/pull/35) ([pfraze](https://github.com/pfraze))

## [v0.2.2](https://github.com/pfraze/local/tree/v0.2.2) (2013-03-11)

[Full Changelog](https://github.com/pfraze/local/compare/v0.2.1...v0.2.2)

**Merged pull requests:**

- valid but falsey response bodies are not transmitted [\#36](https://github.com/pfraze/local/pull/36) ([pfraze](https://github.com/pfraze))

- disable subworkers in applications [\#34](https://github.com/pfraze/local/pull/34) ([pfraze](https://github.com/pfraze))

- alter Link.dispatch to always route through Environment.dispatch [\#33](https://github.com/pfraze/local/pull/33) ([pfraze](https://github.com/pfraze))

- review and update documentation [\#32](https://github.com/pfraze/local/pull/32) ([pfraze](https://github.com/pfraze))

- request targets need a secure default [\#30](https://github.com/pfraze/local/pull/30) ([pfraze](https://github.com/pfraze))

## [v0.2.1](https://github.com/pfraze/local/tree/v0.2.1) (2013-02-27)

[Full Changelog](https://github.com/pfraze/local/compare/v0.2.0...v0.2.1)

**Merged pull requests:**

- <base\> directives in docs are hardwired to grimwire.com [\#31](https://github.com/pfraze/local/pull/31) ([pfraze](https://github.com/pfraze))

- client regions do not update the target context when targeting another region [\#29](https://github.com/pfraze/local/pull/29) ([pfraze](https://github.com/pfraze))

- linkjs-ext/responder should pipe back error response body [\#28](https://github.com/pfraze/local/pull/28) ([pfraze](https://github.com/pfraze))

- create /lib/vendor [\#27](https://github.com/pfraze/local/pull/27) ([pfraze](https://github.com/pfraze))

- need a better solution to docs.js [\#26](https://github.com/pfraze/local/pull/26) ([pfraze](https://github.com/pfraze))

- layouts need a "fork me on github" banner [\#25](https://github.com/pfraze/local/pull/25) ([pfraze](https://github.com/pfraze))

## [v0.2.0](https://github.com/pfraze/local/tree/v0.2.0) (2013-02-24)

[Full Changelog](https://github.com/pfraze/local/compare/0.1.0...v0.2.0)

**Implemented enhancements:**

- add streaming to myhouse replies [\#24](https://github.com/pfraze/local/issues/24)

- request and response data structures need to be refactored, probably with promises [\#23](https://github.com/pfraze/local/issues/23)

- httpRequests to workers need to be queued if the app is not loaded [\#22](https://github.com/pfraze/local/issues/22)

- Evaluate the effects of integrating Mozilla x-tags [\#21](https://github.com/pfraze/local/issues/21)

- Evaluate the URI Template spec for Http.reflectLinks [\#20](https://github.com/pfraze/local/issues/20)

**Closed issues:**

- Memory leak audit [\#19](https://github.com/pfraze/local/issues/19)

## [0.1.0](https://github.com/pfraze/local/tree/0.1.0) (2012-10-12)

**Implemented enhancements:**

- remove agent create on empty responses [\#18](https://github.com/pfraze/local/issues/18)

- add environment layouts and agent-positioning [\#16](https://github.com/pfraze/local/issues/16)

- use alternative name for '.' agent id in css [\#14](https://github.com/pfraze/local/issues/14)

- update agent-server method handling [\#13](https://github.com/pfraze/local/issues/13)

- refactor application/html+json [\#12](https://github.com/pfraze/local/issues/12)

- Need more uniform error behavior [\#11](https://github.com/pfraze/local/issues/11)

- Add default type handler [\#9](https://github.com/pfraze/local/issues/9)

- CLI improvements [\#4](https://github.com/pfraze/local/issues/4)

**Fixed bugs:**

- form submit doesnt get exact uri [\#10](https://github.com/pfraze/local/issues/10)

**Closed issues:**

- write getting-started docs [\#17](https://github.com/pfraze/local/issues/17)

- add environments [\#15](https://github.com/pfraze/local/issues/15)

- Create event-emitter mixin [\#8](https://github.com/pfraze/local/issues/8)

- finish agent lifecycle control [\#7](https://github.com/pfraze/local/issues/7)

- Link Registry needs better integration with user buffers [\#3](https://github.com/pfraze/local/issues/3)

- Server/client constraints are violated for CSS and JS [\#1](https://github.com/pfraze/local/issues/1)



\* *This Change Log was automatically generated by [github_changelog_generator](https://github.com/skywinder/Github-Changelog-Generator)*