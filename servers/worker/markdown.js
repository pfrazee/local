importScripts('servers/worker/vendor/marked.js');
marked.setOptions({ gfm: true, tables: true });

function headerRewrite(headers) {
  headers['content-type'] = 'text/html';
  return headers;
}
function bodyRewrite(md) { return (md) ? marked(md) : ''; }

function main(request, response) {
  var mdRequest = local.web.dispatch({
    method  : 'get',
    url     : local.worker.config.baseUrl + request.path,
    headers : { accept:'text/plain' }
  });
  local.web.pipe(response, mdRequest, headerRewrite, bodyRewrite);
}