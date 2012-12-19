lib = lib/
lib-link-ap = ${lib}link-ap/
link-ap-files =\
 	${lib-link-ap}_compiled_header.js\
 	${lib-link-ap}server.js\
 	${lib-link-ap}client.js\
 	${lib-link-ap}environment.js\
 	${lib-link-ap}_compiled_header.js

setup: clean embeds build

embeds: ${lib}link.js ${lib}common-client.js ${lib}myhouse.js ${lib}worker_bootstrap.js
${lib}link.js:
	cd ${lib}linkjs && ${MAKE}
	cp ${lib}linkjs/link.js ${lib}link.js
${lib}common-client.js:
	# cd ${lib}common-client && ${MAKE}
	cp ${lib}common-client/common-client.js ${lib}common-client.js
${lib}myhouse.js:
	# cd ${lib}myhouse && ${MAKE}
	cp ${lib}myhouse/myhouse.js ${lib}myhouse.js
${lib}worker_bootstrap.js:
	cp ${lib}myhouse/worker_bootstrap.js ${lib}worker_bootstrap.js

build: ${lib}link-ap.js ${lib}worker_core.js
${lib}link-ap.js: ${link-ap-files}
	cat > $@ $^
${lib}worker_core.js:
	cp ${lib}link-ap/worker_core.js ${lib}worker_core.js

clean:
	rm ${lib}link.js ${lib}common-client.js ${lib}myhouse.js ${lib}worker_bootstrap.js
	rm ${lib}link-ap.js ${lib}worker_core.js