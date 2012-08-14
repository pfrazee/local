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
  if ( $query ) {
    $url .= $query;
  }

  $ch = curl_init( $url );
  
  if ( strtolower($_SERVER['REQUEST_METHOD']) != 'get' ) {
    curl_setopt( $ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD'] );
    $body = file_get_contents( 'php://input' );
    if ( $body ) {
      curl_setopt( $ch, CURLOPT_POSTFIELDS, $body );
    }
  }

  // copy over request headers
  $reqheaders = array();
  foreach( getallheaders() as $key => $value ) {
    if( strtolower($key) == 'x-proxy-query' ) {
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
  
  curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, true ); // follow redirects
  curl_setopt( $ch, CURLOPT_HEADER, true );
  curl_setopt( $ch, CURLOPT_HTTPHEADER , $reqheaders ); 
  curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true ); // return, dont print
  curl_setopt( $ch, CURLOPT_SSL_VERIFYPEER, false ); // ssl? sure
  curl_setopt( $ch, CURLOPT_ENCODING , "gzip" ); // properly decompress
  
  curl_setopt( $ch, CURLOPT_USERAGENT, $_GET['user_agent'] ? $_GET['user_agent'] : $_SERVER['HTTP_USER_AGENT'] );
  
  $res = curl_exec( $ch );
  if (!$res) {
    header( "HTTP/1.1 404 Not Found" );
    die;
  }

  // split out headers and body
  $header_size = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
  $header = substr( $res, 0, $header_size );
  $contents = substr( $res, $header_size );

  // split header, in case of redirects
  $headerparts = preg_split( '/([\r\n][\r\n])\\1/', $header );
  $header = array_pop( $headerparts );
  
  $status = curl_getinfo( $ch );
  header( "HTTP/1.1 " . $status['http_code'] );
  
  curl_close( $ch );

  // Split header text into an array.
  $header_text = preg_split( '/[\r\n]+/', $header );

  // Propagate headers to response.
  foreach ( $header_text as $header ) {
      if ( preg_match( '/^(?:Content-Type|Content-Language|Set-Cookie):/i', $header ) ) {
        header( $header );
      }
  }
  
  print $contents;

}

  
?>
