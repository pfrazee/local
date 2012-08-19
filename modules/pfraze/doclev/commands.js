function load(name) {
    var uri = $prof.programs[name];
    var a = $a(name).follow({ uri:uri, method:'get', accept:'application/html+json' });
    return "Loading "+name+" program "+uri;
}
