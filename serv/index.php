<?php

function route() {
    // split request uri into all possible files
    // eg /a/b/c = [/a/b/c, /a/b, /a]
    $requri = preg_replace('/\?.*/i', '', $_SERVER['REQUEST_URI']); // strip query
    $requri_parts = explode('/', $requri);
    $paths = array();
    while (count($requri_parts)) {
        if ($requri_parts[count($requri_parts)-1] != '') { 
            $paths[] = implode($requri_parts, '/');
        }
        array_pop($requri_parts);
    }
    // look for a matching php file
    foreach ($paths as $path) {
        $p = '..'.$path.'.php';
        if (file_exists($p)) {
            require_once($p);
            return TRUE;
        }
    }
    var_dump($paths);
    return FALSE;
}

if (route() == FALSE) {
    header("HTTP/1.0 404 Not Found");
    echo "route not found";
}
?>
