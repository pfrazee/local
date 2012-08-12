<?PHP

// Based on https://github.com/cowboy/php-simple-proxy by http://benalman.com
// All credit to Cowboy

$valid_url_regex = '/.*/';
$url = $_GET['url'];

if ( !$url ) {
  
  // Passed url not specified.
  $contents = 'ERROR: url not specified';
  $status = array( 'http_code' => 'ERROR' );
  
} else if ( !preg_match( $valid_url_regex, $url ) ) {
  
  // Passed url doesn't match $valid_url_regex.
  $contents = 'ERROR: invalid url';
  $status = array( 'http_code' => 'ERROR' );
  
} else {
  // add query params from custom header
  $query = $_SERVER['HTTP_X_PROXY_QUERY'];
  if ($query) {
    $url .= $query;
  }

  $ch = curl_init( $url );
  
  if ( strtolower($_SERVER['REQUEST_METHOD']) == 'post' ) {
    curl_setopt( $ch, CURLOPT_POST, true );
    curl_setopt( $ch, CURLOPT_POSTFIELDS, $_POST );
  }

  // copy over request headers
  $reqheaders = array();
  foreach(getallheaders() as $key => $value) {
    if(strtolower($key) == 'x-proxy-query') {
      continue; // dont use our custom headers
    } else { 
      $reqheaders[] = $key . ':' . $value;
    }
  }
  
  if ( $_GET['send_cookies'] ) {
    $cookie = array();
    foreach ( $_COOKIE as $key => $value ) {
      $cookie[] = $key . '=' . $value;
    }
    if ( $_GET['send_session'] ) {
      $cookie[] = SID;
    }
    $cookie = implode( '; ', $cookie );
    
    curl_setopt( $ch, CURLOPT_COOKIE, $cookie );
  }
  
  curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, true );
  curl_setopt( $ch, CURLOPT_HEADER, true );
  curl_setopt( $ch, CURLOPT_HTTPHEADER , $reqheaders ); 
  curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
  
  curl_setopt( $ch, CURLOPT_USERAGENT, $_GET['user_agent'] ? $_GET['user_agent'] : $_SERVER['HTTP_USER_AGENT'] );
  
  #list( $header, $contents ) = preg_split( '/([\r\n][\r\n])\\1/', curl_exec( $ch ), 2 );
  $res = curl_exec( $ch );
  if (!$res) {
    header( "HTTP/1.0 404 Not Found" );
    die;
  }
  $resparts = preg_split( '/([\r\n][\r\n])\\1/', $res );
  // only take the last 2, in the event of redirects
  $contents = array_pop( $resparts );
  $header = array_pop( $resparts );
  
  $status = curl_getinfo( $ch );
  
  curl_close( $ch );
}

// Split header text into an array.
$header_text = preg_split( '/[\r\n]+/', $header );

// Propagate headers to response.
foreach ( $header_text as $header ) {
  //if ( preg_match( '/^(?:Content-Type|Content-Language|Set-Cookie):/i', $header ) ) {
    header( $header );
  //}
}
  
print $contents;
  
?>
