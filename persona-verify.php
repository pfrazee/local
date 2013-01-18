<?

// lifted directly from https://developer.mozilla.org/en-US/docs/Persona/Remote_Verification_API
// just a simple proxy

$url = 'https://verifier.login.persona.org/verify';
$assert = filter_input(
    INPUT_POST,
    'assertion',
    FILTER_UNSAFE_RAW,
    FILTER_FLAG_STRIP_LOW|FILTER_FLAG_STRIP_HIGH
);
// Use the $_POST superglobal array for PHP < 5.2 and write your own filter 
$params = 'assertion=' . urlencode($assert) . '&audience=' .
           urlencode($_SERVER['SERVER_NAME'] . ':' . $_SERVER['SERVER_PORT']);
$ch = curl_init();
$options = array(
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => TRUE,
    CURLOPT_POST => 2,
    CURLOPT_POSTFIELDS => $params
);
curl_setopt_array($ch, $options);
$result = curl_exec($ch);
curl_close($ch);
header('Content-Type: application/json');
echo $result;

?>