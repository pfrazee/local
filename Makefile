setup: projectfiles
projectfiles: index.html host host/main.js host/welcome.js
index.html:
	cp lib/_setup/index.html index.html
host:
	mkdir host
host/main.js:
	cp lib/_setup/main.js host/main.js
host/welcome.js:
	cp lib/_setup/welcome.js host/welcome.js