src = src/
src-promises-files =\
	${src}promises/promises.js
src-util-files =\
	${src}util/_compiled_header.js\
	${src}util/event-emitter.js\
	${src}util/_compiled_footer.js
src-http-files =\
	${src}http/_compiled_header.js\
	${src}http/helpers.js\
	${src}http/content-types.js\
	${src}http/core.js\
	${src}http/events.js\
	${src}http/uri-template.js\
	${src}http/navigator.js\
	${src}http/_compiled_footer.js
src-client-files =\
	${src}client/_compiled_header.js\
	${src}client/helpers.js\
	${src}client/domevents.js\
	${src}client/responses.js\
	${src}client/regions.js\
	${src}client/_compiled_footer.js
src-env-files =\
	${src}env/_compiled_header.js\
	${src}env/worker.js\
	${src}env/server.js\
	${src}env/core.js\
	${src}env/_compiled_footer.js
src-worker-files =\
	${src-promises-files}\
	${src-util-files}\
	${src-http-files}\
	${src}worker/_compiled_header.js\
	${src}worker/messaging.js\
	${src}worker/http.js\
	${src}worker/setup.js\
	${src}worker/_compiled_footer.js

lib = lib/
lib-local-files =\
	${lib}local/promises.js\
	${lib}local/util.js\
	${lib}local/http.js\
	${lib}local/client.js\
	${lib}local/env.js

setup: clean concat buildmin
	@echo "Done!"

clean:
	@-rm ${lib-local-files}
	@-rm ${lib}local.js ${lib}local.min.js
	@-rm ${lib}worker.js ${lib}worker.min.js
	@echo Cleaned Out Libraries

concat: ${lib-local-files} ${lib}local.js ${lib}worker.js
	@echo Concatted Libraries
${lib}local/promises.js: ${src-promises-files}
	@cat > $@ $^
${lib}local/util.js: ${src-util-files}
	@cat > $@ $^
${lib}local/http.js: ${src-http-files}
	@cat > $@ $^
${lib}local/client.js: ${src-client-files}
	@cat > $@ $^
${lib}local/env.js: ${src-env-files}
	@cat > $@ $^
${lib}local.js: ${lib-local-files}
	@cat > $@ $^
${lib}worker.js: ${src-worker-files}
	@cat > $@ $^

buildmin: ${lib}local.min.js ${lib}worker.min.js
	@echo Built Minified Versions
${lib}local.min.js: ${lib}local.js
	@./minify.sh $@ $^
${lib}worker.min.js: ${lib}worker.js
	@./minify.sh $@ $^

deps: uglifyjs
uglifyjs:
	-git clone git://github.com/mishoo/UglifyJS2.git
	(cd UglifyJS2 && npm link .)