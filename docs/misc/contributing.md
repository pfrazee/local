Contributing
============

pfraze 2013

Please file all issues at the [Github Issue Tracker](//github.com/pfraze/local/issues). You are free to submit pull requests to the 'dev' branch, but please file an issue ahead of time and attach the request to the issue. Pull requests are subject to review, and may not be merged into the repository.

Pull requests can be attached to issues with [ghi](https://github.com/stephencelis/ghi).

```
# example: issue 83, a bug in response streaming
git checkout -b 83-bug-stream

# ..do work..

git commit "fix to response stream"
git push origin 83-bug-stream
ghi edit -H pfraze:83-bug-stream 83
```