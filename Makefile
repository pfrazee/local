lib = lib/
link-ap-files =\
	${lib}globals.js\
	${lib}std/util.js\
	${lib}std/promise.js\
	${lib}std/contenttypes.js\
	${lib}std/http.js\
	${lib}core/request-events.js\
	${lib}core/dropzones.js\
	${lib}core/domserver.js\
	${lib}core/sessions.js\
	${lib}core/agent.js\
	${lib}core/env.js
link-ap-agent-files =\
	${lib}globals.js\
	${lib}std/msgevents.js\
	${lib}std/util.js\
	${lib}std/promise.js\
	${lib}std/contenttypes.js\
	${lib}std/http.js

setup: projectfiles build 

projectfiles: index.html host host/main.js host/welcome.js
index.html:
	cp ${lib}_setup/index.html index.html
host:
	mkdir host
host/main.js:
	cp ${lib}_setup/main.js host/main.js
host/welcome.js:
	cp ${lib}_setup/welcome.js host/welcome.js

build: ${lib}link-ap.js ${lib}link-ap-agent.js
${lib}link-ap.js: ${link-ap-files}
	cat > $@ $^
${lib}link-ap-agent.js: ${link-ap-agent-files}
	cat > $@ $^
