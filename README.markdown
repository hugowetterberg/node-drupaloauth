Node.js and Drupal OAuth credential sharing
===========================================

This is a small module for node.js that makes it possible for a node.js server to share OAuth credentials with Drupal. Token and consumer information is fetched from Drupal (or from a script that has access to the Drupal database) and stored in couchdb. The signature for the call is then verified using [node-oauth](http://github.com/mediacoder/node-oauth) which in turn requires [node-crypto](http://github.com/waveto/node-crypto). [node-couchdb](http://github.com/felixge/node-couchdb) is used to interface with couchdb, but until felixge tweaks the posix-require so that it requires fs instead you can use [my fork](http://github.com/hugowetterberg/node-couchdb).

Testing
-------

The drupaloauth-test.js can be used to run a simple server that verifies incoming requests. There's a companion project [node-drupaloauth-store](http://github.com/hugowetterberg/node-drupaloauth-store) that contains sample code for a credential store and a client to make test calls to the node.js server.

Disclaimer
----------

This is proof of concept stuff, nonces are not tested for uniqueness and access token expiration is not taken into account. Neither is it possible for Drupal to revoke access tokens or consumers. All of these things must be supported for use in a production environment.