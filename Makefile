lib = lib/
lib-link-ap = ${lib}link-ap/
link-ap-files =\
 	${lib-link-ap}document.js

setup: embeds build 

embeds: ${lib}link.js ${lib}common-client.js ${lib}myhouse.js
${lib}link.js:
	cd ${lib}linkjs && ${MAKE}
	cp ${lib}linkjs/link.js ${lib}link.js
${lib}common-client.js:
	# cd ${lib}common-client && ${MAKE}
	cp ${lib}common-client/common-client.js ${lib}common-client.js
${lib}myhouse.js:
	# cd ${lib}myhouse && ${MAKE}
	cp ${lib}myhouse/myhouse.js ${lib}myhouse.js

build: ${lib}link-ap.js
${lib}link-ap.js: ${link-ap-files}
	cat > $@ $^
