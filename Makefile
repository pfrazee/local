setup: clean build buildmin
	@echo "Done!"

clean:
	@-rm local.js local.min.js
	@echo Cleaned Out Libraries

build: local.js
	@echo Browserified library
local.js:
	browserify src/index.js -o local.js

buildmin: local.min.js
	@echo Built Minified Versions
local.min.js: local.js
	@./scripts/minify.sh $@ $^

deps: uglifyjs
uglifyjs:
	-git clone git://github.com/mishoo/UglifyJS2.git
	(cd UglifyJS2 && npm link .)