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
        new (winston.transports.Console)({
            level: 'mod',
            json: false
        })
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

var creds = {
    email: config.auth.username,
    password: config.auth.password
};

var bot = new PlugBotAPI(creds);

bot.connect(config.plug.roomName);

var autoWoot = function () {
    bot.getDJ(function (dj) {
        if (dj.role >= bot.API.ROLE.DJ) {
            logger.log('room', 'Autowooting staff', {dj: dj});
            bot.woot();
        }
    })
};

var reconnectInterval = setInterval(function () {
    logger.log('info', 'RECONNECTING...');
    bot.connect(config.plug.roomName);
}, config.plug.reconnectInterval * 1000);

bot.on('roomJoin', function () {

    logger.log('room', 'Joined room: %s', config.plug.roomName);

    bot.getMedia(function (media) {
        logger.log('room', 'Song Playing', {media: media});
        autoWoot();
        try {
            //scrobble now playing
            lastfm.getSessionKey(function (result) {
                if (result.success) {
                    lastfm.scrobbleNowPlayingTrack({
                        artist: media.author,
                        track: media.title,
                        callback: function (result) {
                            logger.log('lastfm', 'Scrobbled to Now Playing', {result: result, media: media});
                        }
                    });
                }
            });
        } catch (err) {
            logger.log('error', 'ERROR', {error: err});
        }
    });
});

bot.on('advance', function (data) {
    if (data.lastPlay != null && data.lastPlay.media != null) {
        try {
            //scrobble last play
            lastfm.getSessionKey(function (result) {
                if (result.success) {
                    lastfm.scrobbleTrack({
                        artist: data.lastPlay.media.author,
                        track: data.lastPlay.media.title,
                        callback: function (result) {
                            logger.log('lastfm', 'Scrobbled to Last Played', {result: result, media: data.lastPlay.media});
                        }
                    });
                }
            });
        } catch (err) {
            logger.log('error', 'ERROR', {error: err});
        }
    }

    if (data.media != null) {
        logger.log('room', 'Song Playing', {media: data.media});
        autoWoot();
        try {
            //scrobble now playing
            lastfm.getSessionKey(function (result) {
                if (result.success) {
                    lastfm.scrobbleNowPlayingTrack({
                        artist: data.media.author,
                        track: data.media.title,
                        callback: function (result) {
                            logger.log('lastfm', 'Scrobbled to Now Playing', {result: result, media: data.media});
                        }
                    });
                }
            });
        } catch (err) {
            logger.log('error', 'ERROR', {error: err});
        }
    }
});

bot.on('chat', function (data) {
    if (data.message == '.w') {
        bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
            if (hasPermission) {
                logger.log('mod', 'Woot command issued', {data: data});
                bot.woot();
            }
        });
    } else if (data.message == '.m') {
        bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
            if (hasPermission) {
                logger.log('mod', 'Meh command issued', {data: data});
                bot.meh();
            }
        });
    } else if (data.message == '.rules') {
        bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
            if (hasPermission) {
                bot.chat("- Accepted Genres (Yes/Si/Да) Future Garage / Bass / Beats / Downtempo / 170 minimal / Deep House / Ambient / Trip-Hop");
                bot.chat("- Not These Genres (No/Prohibido/Нет) Chillstep (Blackmill) / Chillwave (Washed Out) / Glitch / Psytrance / Indie / Dance / Electro / Techno / Hip-Hop");
            }
        });
    } else if (data.message == '.skip') {
        bot.hasPermission(data.fromID, bot.API.ROLE.BOUNCER, function (hasPermission) {
            if (hasPermission) {
                logger.log('mod', 'Skip command issued', {data: data});
                bot.moderateForceSkip();
            }
        });
    }

    logger.log('chat', '%s: %s', data.un, data.message, {data: data});
});

reconnectInterval();