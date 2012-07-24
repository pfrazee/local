text/explanation+plain

You may have noticed some variables use a dollar sign inside of the identifier.

```js
var uri$agent;
var obj = {
    domid$container,
    dom$container
};
```

This convention classifies types of variables according to intent, not data behavior. It should be read as "for", as in "uri for agent," "domid for container," and "dom for container." It's similar to `agent_uri` or `container_dom`, but it's a little more consistent; underscores are often used to separate words, e.g. `my_container_domid` (which, in this convention, is `domid$my_container`).
