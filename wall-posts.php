<?
// CREATE TABLE wall_posts(id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
$protocol = (isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0');
$request_headers = apache_request_headers();

function getPosts() {
	// make sql request
	$db = new PDO('sqlite:db/sqlite.db') or die ('cannot open database');
	$result = $db->query('SELECT * FROM wall_posts ORDER BY id DESC LIMIT 10');
	$db = NULL;
	$rows = array();
	foreach ($result as $row) {
		// remove hosts from emails
		$email_parts = explode('@', $row['author']);
		$row['author'] = $email_parts[0];
		$rows[] = $row;
	}
	return $rows;
}

if ($_SERVER['REQUEST_METHOD'] == 'POST') {

	// validate auth
	$auth = ($request_headers['authorization']) ? $request_headers['authorization'] : $request_headers['Authorization'];
	if (!$auth) {
		header($protocol.' 401 unauthorized');
		die;
	}
	$auth_parts = explode(' ', $auth);
	if ($auth_parts[0] != 'Persona' || count($auth_parts) != 3) {
		header($protocol.' 401 unauthorized');
		die;		
	}
	// :TODO: validate the session!!!
	$user = substr($auth_parts[1], 5); // skip the 'name='

	// parse body
	$input = json_decode(file_get_contents('php://input'), true);
	if (!$input || !$input['content']) {
		header($protocol.' 400 bad request');
		die;
	}

	// add to database
	$db = new PDO('sqlite:db/sqlite.db') or die ('cannot open database');
	$stmt = $db->prepare("INSERT INTO wall_posts (author, content) VALUES (:author, :content)");
	$stmt->bindParam(':author', $user);
	$stmt->bindParam(':content', $input['content']);
	$stmt->execute();
	$db = NULL;

	// output json
	header($protocol.' 200 ok');
	header('Content-Type: application/json');
	echo json_encode(getPosts());

} else if ($_SERVER['REQUEST_METHOD'] == 'GET') {

	$accept = ($request_headers['accept']) ? $request_headers['accept'] : $request_headers['Accept'];
	if (preg_match('/json/', $accept)) {

		// output json
		header($protocol.' 200 ok');
		header('Content-Type: application/json');
		echo json_encode(getPosts());
	}
	else if (preg_match('/event/', $accept)) {

		// have there been any posts in the last 6 seconds?
		$db = new PDO('sqlite:db/sqlite.db') or die ('cannot open database');
		$stmt = $db->query('SELECT COUNT(*) FROM wall_posts WHERE created_at > DATETIME("now","-6 seconds")');
		$db = NULL;
		$was_updated_recently = (intval($stmt->fetchColumn(0)) > 0);

		// output event-stream
		header('Content-Type: text/event-stream');
		header('Cache-Control: no-cache'); // recommended to prevent caching of event data

		echo "retry: 6000\r\n"; // give us, eh, 6 seconds
		if ($was_updated_recently) {
			echo "event: update\r\n";
			echo "data: true\r\n";
		}
		echo "\r\n";

		// :NOTE: in a server with an event loop, you'd want to keep the connection open and stream events
		//        but PHP aint good for that, so the browser's just going to have to reconnect repeatedly

	}
	else {
		header($protocol.' 406 not acceptable'); // honestly, go think about what you've done
	}
} else {
	// oh noooo
	header($protocol.' 405 method not allowed');
}

/*
header('Content-Type: application/json');

[
	{
		"author":"someguy@aol.com",
		"content":"Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
	},
	{
		"author":"lorem@gmail.com",
		"content":"<a href=\"http://flickr.com/myphotos\">http://flickr.com/myphotos</a> trip photos"
	},
	{
		"author":"another.guy@somewhere.com",
		"content":"This is a wall post."
	}
]
*/?>