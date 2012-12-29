lib = lib/
lib-environment = ${lib}environment/
environment-files =\
 	${lib-environment}_compiled_header.js\
 	${lib-environment}server.js\
 	${lib-environment}client.js\
 	${lib-environment}environment.js\
 	${lib-environment}_compiled_header.js

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

build: ${lib}environment.js ${lib}worker_core.js
${lib}environment.js: ${environment-files}
	cat > $@ $^
${lib}worker_core.js:
	cp ${lib}environment/worker_core.js ${lib}worker_core.js

clean:
	rm ${lib}link.js ${lib}common-client.js ${lib}myhouse.js ${lib}worker_bootstrap.js
	rm ${lib}environment.js ${lib}worker_core.js