var sys = require('sys');
var config = require('./config').config;

var irc = require('./lib/irc');
var fs = require('fs');
var path = require('path');
var repl = require('repl');
var twitter = require('twitter');
var twit = new twitter({
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret,
    access_token_key: config.accessToken,
    access_token_secret:config.accessTokenSecret
});
var twitterHandles = require('./twitter_handles').twitterHandles;

sys.puts(sys.inspect(config));

var logFile, day;
function writeLog(text) {
  var date = new Date();
  var today = [
     date.getFullYear(),
     // Poor man's zero padding FTW
     ('0'+(date.getMonth()+1)).substr(-2),
     ('0'+date.getDate()).substr(-2)
  ].join('-');

  if (!logFile || day !== today) {
    var logFilePath = path.join(config.logPath, today+'.txt');
    logFile = fs.createWriteStream(logFilePath, {'flags': 'a+', 'encoding': 'utf8'});
    day = today;
  }
  
  var time = [
    ('0'+date.getHours()).substr(-2),
    ('0'+date.getMinutes()).substr(-2)
  ].join(':');
  logFile.write('['+time+'] '+text+'\n');
}

var
  client = new irc.Client(config.host, config.port),
  inChannel = false;

client.connect(config.user);

client.addListener('001', function() {
  this.send('JOIN', config.channel);
});

client.addListener('JOIN', function(prefix) {
  inChannel = true;

  var user = irc.user(prefix);
  writeLog(user+' has joined the channel');
});

client.addListener('PART', function(prefix) {
  console.log('part listner');
  
  var user = irc.user(prefix);
  writeLog(user+' has left the channel');
});

client.addListener('DISCONNECT', function() {
  
  sys.puts('Disconnected, re-connect in 5s');
  setTimeout(function() {
    sys.puts('Trying to connect again ...');

    inChannel = false;
    client.connect(config.user);
    setTimeout(function() {
      if (!inChannel) {
        sys.puts('Re-connect timeout');
        client.disconnect();
        client.emit('DISCONNECT', 'timeout');
      }
    }, 5000);
  }, 5000);
});

client.addListener('PRIVMSG', function(prefix, channel, text) {
  switch (text) {
    case '!source':
    case '!src':
      this.send('PRIVMSG', channel, ':Source is here: '+config.srcUrl);
      break;
    case '!logs':
    case '!log':
      this.send('PRIVMSG', channel, ':Logs are here: '+config.logUrl);
      break;
  }

  var user = irc.user(prefix);
  writeLog(user+': '+text);
  var targetResult = text.match(/(.*)\:/) ;
  var targetUser = targetResult ? targetResult[1] : null;

  
  if(targetUser && twitterHandles[targetUser]){
    var twitUser = twitterHandles[targetUser];
    var message = user+" "+text;
    message = message.substring(0,140);
    twit.post('/direct_messages/new.json',
              {screen_name: twitUser, text: message}, 
              "application/json", 
              function(cb){
              });

  }

});

repl.start("logbot> ");
