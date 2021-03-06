var _ = require('lodash');
var Promise = require('bluebird');

// -- internal methods

function preProcessing(request) {
  // find hookId for this route
  var hookId = _.get(request, 'route.settings.app.hook');

  // get methods by hookId
  var methods = _.get(request, 'hooks.' + hookId + '.pre') || [];

  // return the result of each method as any array
  return Promise.map(methods, function(method) {
    var output =  method(request);
    // short circuit out of hapi route using a Boom error
    if (output && output.isBoom) { return Promise.reject(output); }
    else { return output; }
  });
}

function parallelProcessing(request) {
  // find hookId for this route
  var hookId = _.get(request, 'route.settings.app.hook');

  // get methods by hookId
  var methods = _.get(request, 'hooks.' + hookId + '.parallel') || [];

  // return the result of each method as any array
  return Promise.map(methods, function(method) {
    return method(request);
  });
}

function mergeProcessing(request) {
  var parallelProcessed = request.pre.parallelProcessed || [];
  var processed = request.pre.processed;

  parallelProcessed.map(function(result) {
    if (!_.get(processed, result.path)) {
      _.set(processed, result.path, result.data); }
  });
}

function postProcessing(request) {
  // find hookId for this route
  var hookId = _.get(request, 'route.settings.app.hook');

  // get methods by hookId
  var methods = _.get(request, 'hooks.' + hookId + '.post') || [];

  // return the result of each method as any array
  return Promise.map(methods, function(method) {
    return method(request);
  });
}

// -- API

exports.register = function(server, options, next) {
  options = options || {};
  options.hooks = options.hooks || [];
  server.decorate('request', 'hooks', options.hooks);

  // append hardcoded methods to the server
  var internalMethods = [
    {
      name: 'hooks.preProcessing',
      method: preProcessing,
      options: { callback: false }
    },
    {
      name: 'hooks.parallelProcessing',
      method: parallelProcessing,
      options: { callback: false }
    },
    {
      name: 'hooks.merge',
      method: mergeProcessing,
      options: { callback: false }
    },
    {
      name: 'hooks.postProcessing',
      method: postProcessing,
      options: { callback: false }
    }
  ];
  server.method(internalMethods);

  next();
};

exports.register.attributes = {
  name: 'hooks',
  version: '1.0.0'
};
