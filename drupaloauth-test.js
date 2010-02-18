var 
  // System libraries
  sys = require('sys'),
  http = require('http'),
  // http://github.com/felixge/node-couchdb 
  // (or http://github.com/hugowetterberg/node-couchdb until felixge tweaks
  // the posix require)
  couchdb = require('./node-couchdb'),
  drupaloauth = new require('./drupaloauth'),
  // Local variables
  couch_client = couchdb.createClient(5984, 'localhost'),
  db = couch_client.db('nodejs'),
  drupalOAuth = new drupaloauth.DrupalOAuth(db, 'http://oauthstore.hugo/');

http.createServer(function (req, res) {
  // Validate signature
  drupalOAuth.validateRequest(req).addCallback(function(cred) {
    res.sendHeader(200, {'Content-Type': 'application/json'});
    res.sendBody(JSON.stringify({message: 'Yay you are user ' + cred.token.uid}));
    res.finish();
  }).addErrback(function (error) {
    res.sendHeader(401, {'Content-Type': 'application/json'});
    res.sendBody(JSON.stringify(error));
    res.finish();
  });
}).listen(8000);
sys.puts('Server running at http://127.0.0.1:8000/');