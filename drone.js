var PlugBotAPI = require('plugbotapi');
var config = require('config');
var Lastfm = require('simple-lastfm');

var lastfm = new Lastfm({
    api_key: config.lastFm.apiKey,
    api_secret: config.lastFm.apiSecret,
    username: config.lastFm.username,
    password: config.lastFm.password
});

PlugBotAPI.getAuth({
    username: config.auth.username,
    password: config.auth.password
}, function (err, auth) {
    if (err) {
        console.log("[INIT] An error occurred: " + err);
        return;
    }

    var bot = new PlugBotAPI(auth);

    var autoWoot = function () {
        bot.getDJ(function (dj) {
            console.log('[DEBUG] DJ object: ', JSON.stringify(dj));
            bot.hasPermission(dj.id, bot.API.ROLE.RESIDENTDJ, function (hasPermission) {
                if (hasPermission) {
                    console.log('[DEBUG] Autowooting staff');
                    bot.woot();
                }
            });
        })
    };

    bot.connect(config.plug.roomName);

    bot.on('roomJoin', function () {

        console.log('[INIT] Joined room: ', config.plug.roomName);

        bot.getMedia(function (media) {
            console.log('[INIT] Song Playing: ', JSON.stringify(media));
            autoWoot();
            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: media.author,
                            track: media.title,
                            callback: function (result) {
                                console.log("[DEBUG] Scrobbled to Now Playing: ", result);
                            }
                        });
                    }
                });
            } catch (err) {
                console.log("[ERROR]: " + err);
            }
        });
    });

    bot.on('djAdvance', function (data) {
        if (data.lastPlay != null && data.lastPlay.media != null) {
            try {
                //scrobble last play
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleTrack({
                            artist: data.lastPlay.media.author,
                            track: data.lastPlay.media.title,
                            callback: function (result) {
                                console.log("[DEBUG] Scrobbled to Last Played: ", result);
                            }
                        });
                    }
                });
            } catch (err) {
                console.log("[ERROR]: " + err);
            }
        }

        if (data.media != null) {
            autoWoot();
            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: data.media.author,
                            track: data.media.title,
                            callback: function (result) {
                                console.log("[DEBUG] Scrobbled to Now Playing: ", result);
                            }
                        });
                    }
                });
            } catch (err) {
                console.log("[ERROR]: " + err);
            }
        }
    });

    bot.on('chat', function (data) {
        if (data.message == '.w') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    console.log('[DEBUG] wooting');
                    bot.woot();
                }
            });
        } else if (data.message == '.m') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    console.log('[DEBUG] mehing');
                    bot.meh();
                }
            });
        } else if (data.message == '.rules') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    console.log('[DEBUG] Sending rules');
                    bot.chat("- Accepted Genres (Yes/Si/Да) Future Garage / Bass / Beats / Downtempo / 170 minimal / Deep House / Ambient / Trip-Hop");
                    bot.chat("- Not These Genres (No/Prohibido/Нет) Chillstep (Blackmill) / Chillwave (Washed Out) / Glitch / Psytrance / Indie / Dance / Electro / Techno / Hip-Hop");
                }
            });
        }
    })
});