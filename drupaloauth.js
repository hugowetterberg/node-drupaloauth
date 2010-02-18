var DrupalOAuth,
  // System libraries
  events = require('events'),
  url = require("url"),
  // http://github.com/mediacoder/node-oauth
  OAuth=require("./node-oauth").OAuth;


// Here we expect a couchdb.Db from http://github.com/felixge/node-couchdb
// (or http://github.com/hugowetterberg/node-couchdb until felixge tweaks
// the posix require). And a url to where we can get credentials from Drupal.
DrupalOAuth = function (couchDb, credStoreUrl) {
  this.db = couchDb;
  this.credStoreUrl = credStoreUrl;
};

DrupalOAuth.prototype.validateRequest = function (req) {
  var promise = new events.Promise(),
    purl = url.parse(req.url, true);

  setTimeout(function (drupalOAuth) {
    // Don't bother with unsigned requests
    if (!purl.query || !purl.query.oauth_signature || 
        !purl.query.oauth_token || !purl.query.oauth_consumer_key) {
      promise.emitError({'message': 'All requests must be signed with both consumer and token.'});
    }
    else {
      drupalOAuth.getCredentials(purl.query.oauth_token, purl.query.oauth_consumer_key).addCallback(function (cred) {
        var message = {};
        
        // Construct a node-oauth message that we can sign 
        // to verify the recieved signature.
        message.method = req.method;
        message.action = 'http://' + req.headers.host + purl.pathname;
        message.parameters = purl.query;

        drupalOAuth.validateSignature(message, cred).addCallback(function (cred) {
          promise.emitSuccess(cred);
        }).addErrback(function(error) {
          promise.emitError(error);
        });

      }).addErrback(function(error) {
        promise.emitError(error);
      });
    }
  }, 0, this);

  return promise;
};

// Validates the message signature using the credentials.
DrupalOAuth.prototype.validateSignature = function (message, cred) {
  var promise = new events.Promise(),
    accessor = {}, signature = message.parameters.oauth_signature;

  accessor.consumerKey = cred.consumer.consumer_key;
  accessor.consumerSecret = cred.consumer.secret;
  accessor.token = cred.token.token_key;
  accessor.tokenSecret = cred.token.secret;

  OAuth.completeRequest(message, accessor);
  
  if (signature == message.parameters.oauth_signature) {
    promise.emitSuccess(cred);
  }
  else {
    promise.emitError({'message': 'Invalid signature'});
  }
  return promise;
};

// Get the credentials from either couch or Drupal.
DrupalOAuth.prototype.getCredentials = function (tokenKey, consumerKey) {
  var promise = new events.Promise(), db = this.db;
  this.getCredentialsFromCouch(tokenKey, consumerKey).addCallback(function (cred) {
    var kw = {};
    // Check what we got from couch.
    if (!cred.token) {
      kw.oauth_token = tokenKey;
    }
    if (!cred.consumer) {
      kw.oauth_consumer_key = consumerKey;
    }

    // Check if we have something that needs to be fetched from Drupal.
    if (kw.oauth_token || kw.oauth_consumer_key) {
      this.downloadCredentials(kw).addCallback(function(result) {
        // Save the downloaded credentials
        if (result.token) {
          cred.token = result.token;
          db.saveDoc('token-' + result.token.token_key, result.token);
        }
        if (result.consumer) {
          cred.consumer = result.consumer;
          db.saveDoc('consumer-' + result.consumer.consumer_key, result.consumer);
        }
        // Now we've asked both couch and Drupal. And if we still don't have
        // both token and consumer we'll emit a error, otherwise all is fine.
        if (cred.token && cred.consumer) {
          promise.emitSuccess(cred);
        }
        else {
          promise.emitError({'message': 'Couldn\'t get all credentials', 'cred': cred});
        }
      });
    }
    else {
      // We had everything in couch.
      promise.emitSuccess(cred);
    }
  });
  return promise;
};

// Get the credentials from couch-db. This will never fail, but you will not
// always get the credentials either.
DrupalOAuth.prototype.getCredentialsFromCouch = function (tokenKey, consumerKey) {
  var promise = new events.Promise(),
    cred = {}, db = this.db,
    getToken = function () {
      // Getting the token 
      db.getDoc('token-' + tokenKey)
        .addCallback(function (token) {
          cred.token = token;
          promise.emitSuccess(cred);
        }).addErrback(function (error) {
          promise.emitSuccess(cred);
        });
    };
  // Get the consumer from couch-db, regardless of the outcome
  // we'll try to get the token from the database.
  this.db.getDoc('consumer-' + consumerKey)
    .addCallback(function (consumer) {
      cred.consumer = consumer;
      getToken();
    }).addErrback(function (error) {
      getToken();
    });
  
  return promise;
};

// Download the credentials from Drupal.
DrupalOAuth.prototype.downloadCredentials = function (kwArgs) {
  var promise = new events.Promise(),
    url = url.parse(this.credStoreUrl),
    client = http.createClient(url.port, url.hostname),
    request = client.request("GET", OAuth.addToURL(url.pathname, kwArgs), {"host": url.hostname});

  request.finish(function (response) {
    var data = '';
    if (response.statusCode == 200) {
      response.setBodyEncoding("utf8");
      response.addListener("body", function (chunk) {
        data += chunk;
      });
      response.addListener("complete", function() {
        promise.emitSuccess(JSON.parse(data));
      });
    }
    else {
      promise.emitError({'message': 'Failed to download credentials', 'code': response.statusCode});
    }
  });
  return promise;
};

exports.DrupalOAuth = DrupalOAuth;