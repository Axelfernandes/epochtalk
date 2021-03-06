'use strict';
/* jslint node: true */

var socket;
var socketcluster = require('socketcluster-client');

module.exports = ['Alert', 'Auth', 'NotificationSvc', 'Session', '$window', '$rootScope',
function(Alert, Auth, NotificationSvc, Session, $window, $rootScope) {
  // Public channel idenitfier and general options
  var options = { waitForAuth: true };
  var publicChannelKey = JSON.stringify({ type: 'public' });
  var userChannel, publicChannel;

  // Initiate the connection to the websocket server
  socket = socketcluster.connect({
    hostname: forumData.websocket_host,
    port: forumData.websocket_port,
    autoReconnect: true
  });

  // Socket Error logging
  socket.on('error', function(err) {
    if ($window.websocketLogs) { console.log('Websocket error:', err); }
  });

  // Channel Subscribe
  socket.on('subscribe', function(channelName) {
    if (JSON.parse(channelName).type === 'role') {
      socket.watch(channelName, function(data) {
        if ($window.websocketLogs) {
          console.log('Received role channel message.', data);
        }
        Auth.authenticate();
      });
    }
    else if (JSON.parse(channelName).type === 'user') {
      socket.watch(channelName, function(data) {
        if ($window.websocketLogs) { console.log('Received user channel message', data); }
        if (data.action === 'reauthenticate') {
          Auth.authenticate();
        }
        else if (data.action === 'logout' && data.sessionId === socket.getAuthToken().sessionId) {
          Auth.logout();
          Alert.warning('You have been logged out from another window.');
        }
        else if (data.action === 'newMessage') { NotificationSvc.refresh(); }
        else if (data.action === 'refreshMentions') {
          NotificationSvc.refresh();
          NotificationSvc.refreshMentionsList();
        }
      });
    }
    else if (JSON.parse(channelName).type === 'public') {
      socket.watch(channelName, function(data) {
        if (data.action === 'announcement') { Alert.warn(data.message); }
      });
    }
    else {
      if ($window.websocketLogs) {
        console.log('Not watching', channelName);
      }
    }

    if ($window.websocketLogs) {
      console.log('Websocket subscribed to', channelName, 'with watchers', socket.watchers(channelName));
    }
  });

  // Channel Unsubscribe
  socket.on('unsubscribe', function(channelName) {
    if ($window.websocketLogs) {
      console.log('Websocket unsubscribed from', channelName, socket.watchers(channelName));
    }
    // disconnect all watchers from the channel
    socket.unwatch(channelName);
  });

  // Socket Authentication
  socket.on('authenticate', function() {
    if ($window.websocketLogs) { console.log('Authenticated WebSocket Connection'); }

    // Emit LoggedIn event to socket server
    socket.emit('loggedIn');

    // subscribe to user channel
    var userChannelKey = JSON.stringify({ type: 'user', id: Session.user.id });
    userChannel = socket.subscribe(userChannelKey, options);

    // subscribe to roles channels
    if (Session.user.roles) {
      Session.user.roles.forEach(function(role) {
        var channel = JSON.stringify({ type: 'role', id: role });
        socket.subscribe(channel, options);
      });
    }
  });

  // Handle LoginEvent
  $rootScope.$on('loginEvent', socketLogin);

  // Handle LogoutEvent
  $rootScope.$on('logoffEvent', function() {
    socket.subscriptions().forEach(function(channel) {
      if (channel !== publicChannelKey) { socket.unsubscribe(channel); }
    });

    socket.deauthenticate();
    socket.emit('loggedOut');
  });

  function socketLogin() {
    socket.authenticate(Session.getToken());
    NotificationSvc.refresh();
    NotificationSvc.refreshMentionsList();
  }

  // API Functions
  function watchUserChannel(handler) {
    if (userChannel) { userChannel.watch(handler); }
    else { setTimeout(function() { watchUserChannel(handler); }, 1000); }
  }

  function unwatchUserChannel(handler) {
    if (userChannel) { userChannel.unwatch(handler); }
  }

  function isOnline (user, callback) {
    if (socket.state === 'open') { socket.emit('isOnline', user, callback); }
    else { setTimeout(function() { isOnline(user, callback); }, 1000); }
  }

  // init function
  if (Session.getToken()) { socketLogin(); }
  // always subscribe to the public channel
  publicChannel = socket.subscribe(publicChannelKey, options);

  return {
    watchUserChannel: watchUserChannel,
    unwatchUserChannel: unwatchUserChannel,
    isOnline: isOnline
  };
}];
