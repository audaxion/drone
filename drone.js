var PlugBotAPI = require('plugbotapi');
var config = require('config');
var Lastfm = require('simple-lastfm');
var moment = require('moment');
var winston = require('winston');
var path = require('path');

var winstonConfig = {
    levels: {
        chat: 0,
        user: 1,
        mod: 2,
        room: 3,
        lastfm: 4,
        info: 5,
        warn: 6,
        debug: 7,
        error: 8
    }
};

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.DailyRotateFile)({
            filename: path.join(__dirname, 'logs', 'drone.log'),
            handleExceptions: true,
            level: 'chat',
            json: false
        }),
        new (winston.transports.Console)({level: 'error'})
    ],
    levels: winstonConfig.levels,
    exitOnError: false
});

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
        //console.log('[ INIT ] An error occurred:', err);
        logger.log('error','An error occurred', {error: err});
        return;
    }

    var bot = new PlugBotAPI(auth);

    var autoWoot = function () {
        var time = moment().format();
        bot.getDJ(function (dj) {
            bot.hasPermission(dj.id, bot.API.ROLE.RESIDENTDJ, function (hasPermission) {
                if (hasPermission) {
                    //console.log('[', time, '][ DEBUG ] Autowooting staff: ', dj.username);
                    logger.log('room','Autowooting staff', {dj: dj});
                    bot.woot();
                }
            });
        })
    };

    bot.connect(config.plug.roomName);

    var reconnectInterval = setInterval( function () {
        var time = moment().format();
        //console.log('[', time, '][ INFO ] RECONNECTING...');
        logger.log('info','RECONNECTING...');
        bot.connect(config.plug.roomName);
    }, config.plug.reconnectInterval * 1000);

    bot.on('roomJoin', function () {

        var time = moment().format();
        //console.log('[', time, '][', time, '][ INIT ] Joined room: ', config.plug.roomName);
        logger.log('room','Joined room: %s', config.plug.roomName);

        bot.getMedia(function (media) {
            //console.log('[', time, '][ INIT ] Song Playing: ', JSON.stringify(media));
            logger.log('room','Song Playing', {media: media});
            autoWoot();
            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: media.author,
                            track: media.title,
                            callback: function (result) {
                                //console.log('[', time, '][ DEBUG ] Scrobbled to Now Playing: ', result);
                                logger.log('lastfm','Scrobbled to Now Playing', {result: result, media: media});
                            }
                        });
                    }
                });
            } catch (err) {
                //console.log('[', time, '][ ERROR ]: ', err);
                logger.log('error', {error: err});
            }
        });
    });

    bot.on('djAdvance', function (data) {
        var time = moment().format();
        if (data.lastPlay != null && data.lastPlay.media != null) {
            try {
                //scrobble last play
                lastfm.getSessionKey(function (result) {
                    if (result.success) {
                        lastfm.scrobbleTrack({
                            artist: data.lastPlay.media.author,
                            track: data.lastPlay.media.title,
                            callback: function (result) {
                                //console.log('[', time, '][ DEBUG ] Scrobbled to Last Played: ', result);
                                logger.log('lastfm','Scrobbled to Last Played', {result: result, media: data.lastPlay.media});
                            }
                        });
                    }
                });
            } catch (err) {
                //console.log('[', time, '][ ERROR ]: ', err);
                logger.log('error', {error: err});
            }
        }

        if (data.media != null) {
            logger.log('room','Song Playing', {media: data.media});
            autoWoot();
            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: data.media.author,
                            track: data.media.title,
                            callback: function (result) {
                                //console.log('[', time, '][ DEBUG ] Scrobbled to Now Playing: ', result);
                                logger.log('lastfm','Scrobbled to Now Playing', {result: result, media: data.media});
                            }
                        });
                    }
                });
            } catch (err) {
                //console.log('[', time, '][ ERROR ]: ', err);
                logger.log('error', {error: err});
            }
        }
    });

    bot.on('chat', function (data) {
        var time = moment().format();
        if (data.message == '.w') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    //console.log('[', time, '][ DEBUG ] ', data.from, ' wooting');
                    logger.log('mod','Woot command issued', {data: data});
                    bot.woot();
                }
            });
        } else if (data.message == '.m') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    //console.log('[', time, '][ DEBUG ] ', data.from, ' mehing');
                    logger.log('mod','Meh command issued', {data: data});
                    bot.meh();
                }
            });
        } else if (data.message == '.rules') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    //console.log('[', time, '][ DEBUG ] Sending rules');
                    bot.chat("- Accepted Genres (Yes/Si/Да) Future Garage / Bass / Beats / Downtempo / 170 minimal / Deep House / Ambient / Trip-Hop");
                    bot.chat("- Not These Genres (No/Prohibido/Нет) Chillstep (Blackmill) / Chillwave (Washed Out) / Glitch / Psytrance / Indie / Dance / Electro / Techno / Hip-Hop");
                }
            });
        } else if (data.message == '.skip') {
            bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
                if (hasPermission) {
                    //console.log('[', time, '][ DEBUG ] skipping');
                    logger.log('mod','Skip command issued', {data: data});
                    bot.moderateForceSkip();
                }
            });
        }

        //console.log('[', time, '][ CHAT ] ', data.from, ':', data.message);
        logger.log('chat', '%s: %s', data.from, data.message, {data: data});
    })
});