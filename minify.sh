#!/bin/bash

output=$1; shift

if ! command -v uglifyjs &> /dev/null ; then
	echo ==========================================================
	echo UglifyJS not found -- minified files are just concatenated
	echo ==========================================================
	cat > ${output} $@
	exit 0
fi

uglifyjs $@ -o ${output} -c -m --screw-ie8