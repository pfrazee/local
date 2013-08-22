src = src/
src-promises-files =\
	${src}promises/promises.js
src-util-files =\
	${src}util/_compiled_header.js\
	${src}util/event-emitter.js\
	${src}util/dom.js\
	${src}util/helpers.js\
	${src}util/_compiled_footer.js
src-web-files =\
	${src}web/_compiled_header.js\
	${src}web/constants.js\
	${src}web/helpers.js\
	${src}web/content-types.js\
	${src}web/request.js\
	${src}web/response.js\
	${src}web/schemes.js\
	${src}web/dispatch.js\
	${src}web/subscribe.js\
	${src}web/uri-template.js\
	${src}web/navigator.js\
	${src}web/_compiled_footer.js
src-env-files =\
	${src}env/_compiled_header.js\
	${src}env/worker.js\
	${src}env/server.js\
	${src}env/rtcpeer.js\
	${src}env/core.js\
	${src}env/_compiled_footer.js
src-toplevel-files =\
	${src}_compiled_header.js\
	${src}aliases.js\
	${src}request-dom-events.js\
	${src}_compiled_footer.js
src-worker-files =\
	${src-promises-files}\
	${src-util-files}\
	${src-web-files}\
	${src}worker/_compiled_header.js\
	${src}worker/page-connection.js\
	${src}worker/web.js\
	${src}worker/setup.js\
	${src}worker/_compiled_footer.js\
	${src-toplevel-files}

lib = lib/
lib-local-files =\
	${lib}local/promises.js\
	${lib}local/util.js\
	${lib}local/web.js\
	${lib}local/env.js

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
${lib}local/env.js: ${src-env-files}
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