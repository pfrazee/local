```javascript
local.http.parseUri('http://myserver.com/foobar?q=4');
// => {anchor: "", query: "q=4", file: "", directory: "/foobar", path: "/foobar" ...}
```

<br/>
#### Link.parseUri( <small>request / url</small> ) <small> =>url description object</small>

Written by Stephen Levithan. It breaks the input URL into its component parts:

```
// http://usr:pwd@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top
{
  anchor: "top"
  authority: "usr:pwd@www.test.com:81"
  directory: "/dir/dir.2/"
  file: "index.htm"
  host: "www.test.com"
  password: "pwd"
  path: "/dir/dir.2/index.htm"
  port: "81"
  protocol: "http"
  query: "q1=0&&test1&test2=value"
  queryKey: {
    q1: "0"
    test1: ""
    test2: "value"
  }
  relative: "/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"
  source: "http://usr:pwd@www.test.com:81/dir/dir.2/index.htm?q1=0&&test1&test2=value#top"
  user: "usr"
  userInfo: "usr:pwd" 
}
```

<a target="_blank" href="http://stevenlevithan.com/demo/parseuri/js/">Read the full reference at Steven Levithan's site.</a>