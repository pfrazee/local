<?php
// pull out suburi
$requri = preg_replace('/^(.*\/files)/i', '', $_SERVER['REQUEST_URI']);

function get_fullpath($path) {
    $root = realpath(dirname(__FILE__));
    return implode('/', array($root, '_files', trim($path, '/')));
}

function human_filesize($bytes) {
    $units = array(' B', ' KB', ' MB', ' GB', ' TB');
    for ($i=0; $bytes >= 1024 && $i < 4; $i++) { $bytes /= 1024; }
    return round($bytes, 2) . $units[$i];
}

function read_meta($path) {
    $meta = array();
    $fullpath = get_fullpath($path);
    $stat = stat($fullpath);
    if (!$stat) { return FALSE; }
    $meta['size'] = human_filesize($stat['size']);
    $meta['bytes'] = $stat['size'];
    $meta['modified'] = $stat['mtime'];
    $meta['path'] = $path;
    $meta['is_dir'] = is_dir($fullpath);
    $meta['mime_type'] = mime_content_type($fullpath); // deprecated...meh
    return $meta;
}

function read_dir($path) {
    $fullpath = get_fullpath($path);
    $fnames = scandir($fullpath);
    if (!$fnames) { return FALSE; }
    // gather metadata for each file
    $contents = array();
    foreach ($fnames as $fname) {
        if ($fname == '.' || $fname == '..') { continue; }
        $fpath = join('/', array($path, $fname));
        $contents[] = read_meta($fpath);
    }
    return $contents;
}

function read_file($path) {
    $fullpath = get_fullpath($path);
    return file_get_contents($fullpath);
}

function write_file($path, $data) {
    $fullpath = get_fullpath($path);
    file_put_contents($fullpath, $data);
}

try {
    // route method
    if ($_SERVER['REQUEST_METHOD'] == 'GET') {
        // grab metadata
        $res = read_meta($requri);
        
        if (!$res) {
            header("HTTP/1.0 404 Not Found");
            die;
        }

        // read file/dir
        if ($res['is_dir']) {
            $res['contents'] = read_dir($requri);
        } else {
            $res['data'] = read_file($requri);
        }

    } else if ($_SERVER['REQUEST_METHOD'] == 'PUT') {
        // write body
        $body = file_get_contents('php://input');
        write_file($requri, $body);

        // respond with metadata
        $res = read_meta($requri);

        if (!$res) {
            header("HTTP/1.0 400 Failed");
            die;
        }

   } else {
        header("HTTP/1.0 405 Not Allowed");
    }

        // output by requested type
    if (strstr($_SERVER['HTTP_ACCEPT'], 'text/plain')) {
        header('content-type: text/plain');
        if ($res['is_dir']) {
            for ($i=0; $i < count($res['contents']); $i++) {
                echo $res['contents'][$i]['path']; echo "\n";
            }
        } else {
            echo $res['data'];
        }
    } else if (TRUE || strstr($_SERVER['HTTP_ACCEPT'], 'application/json')) {
        header('content-type: application/json');
        echo json_encode($res);
    }

} catch (Exception $e) {
    header("HTTP/1.0 400");
    echo $e->getMessage();
}

?>
