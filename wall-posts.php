<?
// CREATE TABLE wall_posts(id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, content TEXT NOT NULL)
$protocol = (isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0');
$request_headers = apache_request_headers();

if ($_SERVER['REQUEST_METHOD'] == 'POST') {

	// validate auth
	$auth = $request_headers['authorization'];
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

	header($protocol.' 200 ok');

} else if ($_SERVER['REQUEST_METHOD'] == 'GET') {

	// get posts
	$db = new PDO('sqlite:db/sqlite.db') or die ('cannot open database');
	$result = $db->query('SELECT * FROM wall_posts ORDER BY id DESC LIMIT 15');
	$db = NULL;
	$rows = array();
	foreach ($result as $row) {
		$rows[] = $row;
	}

	// output json
	header($protocol.' 200 ok');
	header('Content-Type: application/json');
	echo json_encode($rows);
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