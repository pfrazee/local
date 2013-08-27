src = src/
src-promises-files =\
	${src}promises/promises.js
src-util-files =\
	${src}util/000_header.js\
	${src}util/001_event-emitter.js\
	${src}util/002_dom.js\
	${src}util/003_helpers.js\
	${src}module_footer.js
src-web-files =\
	${src}web/000_header.js\
	${src}web/001_constants.js\
	${src}web/002_helpers.js\
	${src}web/003_content-types.js\
	${src}web/004_request.js\
	${src}web/005_response.js\
	${src}web/006_server.js\
	${src}web/007_worker-server.js\
	${src}web/008_rtcpeer-server.js\
	${src}web/009_schemes.js\
	${src}web/010_dispatch.js\
	${src}web/011_subscribe.js\
	${src}web/012_uri-template.js\
	${src}web/013_navigator.js\
	${src}web/014_hosts-service.js\
	${src}web/015_relay-service.js\
	${src}module_footer.js
src-toplevel-files =\
	${src}000_header.js\
	${src}001_config.js\
	${src}002_aliases.js\
	${src}003_spawners.js\
	${src}004_request-dom-events.js\
	${src}module_footer.js
src-worker-files =\
	${lib-local-files}\
	${src}worker/000_header.js\
	${src}worker/001_page-server.js\
	${src}worker/002_worker-env.js\
	${src}module_footer.js

lib = lib/
lib-local-files =\
	${lib}local/promises.js\
	${lib}local/util.js\
	${lib}local/web.js

setup: clean concat buildmin
	@echo "Done!"

clean:
	@-rm ${lib-local-files}
	@-rm ${lib}local.js ${lib}local.min.js
	@-rm worker.js worker.min.js
	@echo Cleaned Out Libraries

concat: ${lib-local-files} ${lib}local.js worker.js
	@echo Concatted Libraries
${lib}local/promises.js: ${src-promises-files}
	@cat > $@ $^
${lib}local/util.js: ${src-util-files}
	@cat > $@ $^
${lib}local/web.js: ${src-web-files}
	@cat > $@ $^
${lib}local.js: ${lib-local-files} ${src-toplevel-files}
	@cat > $@ $^
worker.js: ${src-worker-files}
	@cat > $@ $^

buildmin: ${lib}local.min.js worker.min.js
	@echo Built Minified Versions
${lib}local.min.js: ${lib}local.js
	@./minify.sh $@ $^
worker.min.js: worker.js
	@./minify.sh $@ $^

deps: uglifyjs
uglifyjs:
	-git clone git://github.com/mishoo/UglifyJS2.git
	(cd UglifyJS2 && npm link .)