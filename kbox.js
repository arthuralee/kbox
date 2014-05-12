Router.map(function() {
  this.route('player');
  this.route('client', {path: '/'});
});

Videos = new Meteor.Collection('videos');

// ====================================
// ============= PLAYER ===============
// ====================================
/*
Status:
0 - queued
1 - playing
2 - done
 */

if (Meteor.isClient) {
  Template.player.videos = function () {
    return Videos.find({status:0}, {sort: {score: -1}});
  };
  Template.player.currVideo = function () {
    return Videos.findOne({status: 1});
  };

  Template.player.rendered = function() {
    window.onYouTubePlayerAPIReady = function() {
      // create the global player from the specific iframe (#video)
      window.player = new YT.Player('ytplayer', {
        events: {
          // call this function when player is ready to use
          'onReady': onPlayerReady
        }
      });
    };
    window.onPlayerReady = function(event) {
      window.player.addEventListener("onStateChange", "onytplayerStateChange");
      nextVideo();
    };
    window.onytplayerStateChange = function(newState) {
      if (newState.data === YT.PlayerState.ENDED) {
        nextVideo();
      }
    };

    var nextVideo = function() {
      var playingVid = Videos.findOne({status:1});
      if (playingVid) {
        Videos.update({_id: playingVid._id}, {$set: {status: 2}});
      }
      
      var firstVid = Videos.findOne({status: 0}, {sort: {score: -1}});

      if (firstVid) {
        Videos.update({_id: firstVid._id}, {$set: {status: 1}});
        // play the video
        window.player.loadVideoById(firstVid.link);
      }
    };

    Videos.find().observe({
      added: function() {
        // Check if it was the only video in playlist
        if (Videos.find({status:1}).count() === 0) {
          nextVideo();
        }
      }
    });
  };
}

// ====================================
// ============= CLIENT ===============
// ====================================
if (Meteor.isClient) {
  Template.client.videos = function () {
    return Videos.find({status:0}, {sort: {score: -1}});
  };
  Template.client.firstVideo = function () {
    return Videos.findOne({status: 1});
  };
  Template.client.rendered = function() {
    if (!SessionAmplify.get('voted')) SessionAmplify.set('voted', []);
  }
  Template.client.searchResults = function() {
    return Session.get('searchResults');
  }
  Template.client.currVideo = function () {
    return Videos.findOne({status: 1});
  };

  Template.client.events({
    'submit #search-form': function(e) {
      e.preventDefault();
      var input = $('#search-input', e.target);
      $.get('https://www.googleapis.com/youtube/v3/search', {
        'key': 'AIzaSyArzGCKV1-msUpixN4oaYkL4gv3ekdJaA0',
        'part': 'snippet',
        'q': input.val()
      },function(data){
        Session.set('searchResults', data.items.map(function(item) {
          return {
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle
          }
        }));
        input.val('');
      });

    },
    'click .playlist-item': function(e) {
      if (voted(this._id)) {
        return;
      } else {
        addVoteSession(this._id);
        Videos.update({_id:this._id}, {$inc: {score:1}});
      }
    },
    'click .search-results li': function(e) {
      Videos.insert({
        link: this.id,
        score:0,
        status:0,
        title: this.title
      });
    }
  });

  var addVoteSession = function(id) {
    var voted = SessionAmplify.get('voted');
    voted.push(id);
    SessionAmplify.set('voted', voted);
  };
  var voted = function(id) {
    return SessionAmplify.get('voted').indexOf(id) !== -1;
  }
}

// On server startup, create some players if the database is empty.
if (Meteor.isServer) {
  /*
  Meteor.startup(function () {
    if (Players.find().count() === 0) {
      var names = ["Ada Lovelace",
                   "Grace Hopper",
                   "Marie Curie",
                   "Carl Friedrich Gauss",
                   "Nikola Tesla",
                   "Claude Shannon"];
      for (var i = 0; i < names.length; i++)
        Players.insert({name: names[i], score: Math.floor(Random.fraction()*10)*5});
    }
  });
  */
}