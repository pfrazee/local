src = src/
common-client-files =\
	${src}common-client/common-client.js
environment-files =\
 	${src}environment/_compiled_header.js\
 	${src}environment/server.js\
 	${src}environment/client.js\
 	${src}environment/environment.js\
 	${src}environment/_compiled_footer.js
linkjs-files =\
	${src}linkjs/_compiled_header.js\
	${src}linkjs/helpers.js\
	${src}linkjs/core.js\
	${src}linkjs/events.js\
	${src}linkjs/navigator.js\
	${src}linkjs/uri-template.js\
	${src}linkjs/_compiled_footer.js
linkjs-ext-files =\
	${src}linkjs-ext/broadcaster.js\
	${src}linkjs-ext/responder.js\
	${src}linkjs-ext/router.js
myhouse-files =\
	${src}myhouse/myhouse.js
promises-files =\
	${src}promises/promises.js
worker-server-files =\
	${src}myhouse/worker-bootstrap.js\
	${promises-files}\
	${linkjs-files}\
	${src}environment/worker-httpl.js

lib = lib/
lib-local-files =\
	${lib}local/promises.js\
	${lib}local/link.js\
	${lib}local/myhouse.js\
	${lib}local/common-client.js\
	${lib}local/environment.js	
lib-linkjs-ext-files =\
	${lib}linkjs-ext/broadcaster.js\
	${lib}linkjs-ext/responder.js\
	${lib}linkjs-ext/router.js
lib-worker-server-files =\
	${lib}local/worker-server.js

setup: clean concat minify dev

clean:
	-rm ${lib-local-files} ${lib-worker-server-files}
	-rm ${lib}local.js ${lib}local.min.js ${lib}local.dev.js
	-rm ${lib}worker-server.js ${lib}worker-server.min.js ${lib}worker-server.dev.js

# ${lib}local/common-client.js ${lib}local/environment.js ${lib}local/link.js ${lib}local/myhouse.js ${lib}local/promises.js ${lib}local/worker-server.js ${lib}linkjs-ext
concat: ${lib-local-files} ${lib-linkjs-ext-files} ${lib-worker-server-files}
${lib}local/common-client.js: ${common-client-files}
	cat > $@ $^
${lib}local/environment.js: ${environment-files}
	cat > $@ $^
${lib}local/link.js: ${linkjs-files} ${linkjs-ext-files}
	cat > $@ $^
${lib}local/myhouse.js: ${myhouse-files}
	cat > $@ $^
${lib}local/promises.js: ${promises-files}
	cat > $@ $^
${lib}local/worker-server.js: ${worker-server-files}
	cat > $@ $^
${lib}linkjs-ext/broadcaster.js: ${src}linkjs-ext/broadcaster.js
	cp $< $@
${lib}linkjs-ext/responder.js: ${src}linkjs-ext/responder.js
	cp $< $@
${lib}linkjs-ext/router.js: ${src}linkjs-ext/router.js
	cp $< $@

minify: ${lib}local.js ${lib}local.min.js ${lib}worker-server.js ${lib}worker-server.min.js
${lib}local.js: ${lib-local-files}
	cat > $@ $^
${lib}local.min.js: ${lib-local-files}
	cat > $@ $^ # :TODO: actual minification
${lib}worker-server.js: ${lib-worker-server-files}
	cp $< $@
${lib}worker-server.min.js: ${lib-worker-server-files}
	cp $< $@ # :TODO: actual minification

dev: ${lib}local.dev.js ${lib}worker-server.dev.js
${lib}local.dev.js: ${promises-files} ${linkjs-files} ${linkjs-ext-files} ${myhouse-files} ${common-client-files} ${environment-files}
	echo $(foreach f, $^, "document.write('<script src=\"/$f\"></script>');\n") >> ${lib}local.dev.js
${lib}worker-server.dev.js: ${worker-server-files}
	echo $(foreach f, $^, "importScripts(\"/$f\");\n") >> ${lib}worker-server.dev.js