function load(uri, agent_name) {
    var a = $a(agent_name);
    a.follow({ uri:uri, method:'get', accept:'application/html+json' });
    return "Loading "+uri+" program in "+a.getId();
}
