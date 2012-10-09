// == SECTION Sessions Auth Schemes
Sessions.init();
var sess = {
	id:100,
	agent_id:'foobar',
	perms:['a','b','c'],
	username:'john',
	password:'doe'
};
print(Sessions.getAuthScheme(null)(sess));
// => null
print(Sessions.getAuthScheme('Basic')(sess));
// => Basic john:doe
print(Sessions.getAuthScheme('LAPSession')(sess));
// => LAPSession id=100 agent=foobar perms=a,b,c