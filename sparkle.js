var PlugBotAPI = require('plugbotapi');
var fs = require('fs');
path = require('path');
var config = require('config');
var runCount = 0;
var startupTimestamp = new Date();
var bot;

/*if (config.plug.auth != "") {
    console.log("[INIT] Using auth key: " + config.plug.auth);
    runBot(false, config.plug.auth);
}
else {
    // @todo Set up plug-dj-login handling
}*/

PlugBotAPI.getAuth({
    username: config.auth.username,
    password: config.auth.password
}, runBot);


function runBot(error, auth) {
    if(error) {
        console.log("[INIT] An error occurred: " + err);
        return;
    }

    bot = new PlugBotAPI(auth);

    initializeModules(auth);

    bot.connect(config.plug.roomName);
    //bot.tcpListen(config.port, config.address);

    bot.on('roomJoin', function(data) {

        console.log('[INIT] Joined room:', data);

        /*if (config.responses.botConnect !== "") {
            bot.sendChat(config.responses.botConnect);
        }*/
        if (bot.getMedia() != null) {
            autoWoot();

            var media = bot.getMedia();
            console.log(media);
            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: media.author,
                            track: media.title,
                            callback: function (result) {
                                console.log("in callback, finished: ", result);
                            }
                        });
                    }
                });
            } catch(err) {
                console.log("[ERROR]: " + err);
            }
        }

        bot.getUsers(function(users) {
            users.forEach(function(user) {
                addUserToDb(user);
            });
        });
    });

    bot.on('chat', function(data) {
        console.log('[CHAT]', data.from + ': ' + data.message);
        handleCommand(data);
        db.run('UPDATE USERS SET lastActive = CURRENT_TIMESTAMP WHERE userid = ?', [data.fromID]);
        db.run('UPDATE DISCIPLINE SET warns = 0 WHERE userid = ?', [data.fromID]);
    });

    bot.on('userJoin', function(data) {
        console.log('[JOIN]', data.username);

        var newUser = false;

        if (data.username != config.plug.botName) {
            getUserFromDb(data, function (dbUser) {

                if (dbUser == undefined) {
                    newUser = true;
                    console.log('[JOIN] ' + data.username + ' is a first-time visitor to the room!');
                }
                else {
                    console.log('[JOIN] ' + data.username + ' last seen '+ dbUser.secondsSinceLastSeen + ' seconds ago (' + dbUser.lastSeen + ')');
                }

                db.run('UPDATE USERS SET lastSeen = CURRENT_TIMESTAMP, lastActive = CURRENT_TIMESTAMP, lastWaitListPosition = -1 WHERE userid = ?', [data.id]);

                // Restore spot in line if user has been gone < 10 mins
                /*if(!newUser && dbUser.secondsSinceLastSeen <= 600 && dbUser.lastWaitListPosition != -1 && bot.getWaitListPosition(data.id) != dbUser.lastWaitListPosition) {
                    bot.moderateAddDJ(data.id, function() {
                        if(bot.getWaitListPosition(data.id) != dbUser.lastWaitListPosition) {
                            bot.moderateMoveDJ(data.id, dbUser.lastWaitListPosition + 1);
                        }
                        setTimeout(function(){ bot.sendChat('I put you back in line, @' + data.username + ' :thumbsup:')}, 5000);
                    });
                }*/

            });
            addUserToDb(data);
        }
    });

    bot.on('userLeave', function(data) {
        getUserFromDb(data, function (user) {
            if(user) {
                console.log('[LEAVE]', 'User left: ' + user.username);
            }
        });
        db.run('UPDATE OR IGNORE USERS SET lastSeen = CURRENT_TIMESTAMP WHERE userid = ?', [data.id]);
    });

    bot.on('userUpdate', function(data) {
        console.log('User update: ', data);
    });

    bot.on('curateUpdate', function(data) {
        var user = _.findWhere(bot.getUsers(), {id: data.id});
        if (user) {
            console.log('[GRAB]', user.username + ' grabbed this song');
        }
        db.run('UPDATE USERS SET lastActive = CURRENT_TIMESTAMP WHERE userid = ?', [data.id]);
    });

    bot.on('voteUpdate', function(data) {
        var user = _.findWhere(bot.getUsers(), {id: data.id});
        if (user) {
            console.log('[VOTE]', user.username + ' voted ' + data.vote);
        }
    });

    bot.on('djAdvance', function(data) {
        if (config.verboseLogging) {
            console.log('djAdvance: ', JSON.stringify(data, null, 2));
        }

        if(data.dj != null && data.media != null) {
            console.log('[SONG]', data.dj.user.username + ' played: ' + data.media.author + ' - ' + data.media.title);
            db.run('UPDATE USERS SET lastWaitListPosition = -1 WHERE userid = ?', [data.dj.user.id]);
        }

        // Write previous song data to DB
        // But only if the last song actually existed
        if (data.lastPlay != null && data.lastPlay.media != null) {
            db.run('INSERT OR IGNORE INTO SONGS VALUES (?, ?, ?, ?, ?, ?)',
                [data.lastPlay.media.id,
                    data.lastPlay.media.title,
                    data.lastPlay.media.format,
                    data.lastPlay.media.author,
                    data.lastPlay.media.cid,
                    data.lastPlay.media.duration]);
            db.run('INSERT INTO PLAYS (userid, songid, upvotes, downvotes, snags, started, listeners) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
                [data.lastPlay.dj.id,
                    data.lastPlay.media.id,
                    data.lastPlay.score.positive,
                    data.lastPlay.score.negative,
                    data.lastPlay.score.curates,
                    data.lastPlay.score.listeners]);

            try {
                //scrobble last play
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleTrack({
                            artist: data.lastPlay.media.author,
                            track: data.lastPlay.media.title,
                            callback: function (result) {
                                console.log("in callback, finished: ", result);
                            }
                        });
                    }
                });
            } catch(err) {
                console.log("[ERROR]: " + err);
            }
        }

        if (data.media != null) {
            autoWoot();

            // Perform automatic song metadata correction
            if (config.plug.autoSuggestCorrections) {
                correctMetadata();
            }

            try {
                //scrobble now playing
                lastfm.getSessionKey(function (result) {
                    console.log("session key = " + result.session_key);
                    if (result.success) {
                        lastfm.scrobbleNowPlayingTrack({
                            artist: data.media.author,
                            track: data.media.title,
                            callback: function (result) {
                                console.log("in callback, finished: ", result);
                            }
                        });
                    }
                });
            } catch(err) {
                console.log("[ERROR]: " + err);
            }

            /*var maxIdleTime = config.plug.activeDJTimeoutMins * 60;
            var roomHasActiveMods = false;
            var idleDJs = [];
            var z = 0;

            idleWaitList = bot.getWaitList();
            idleWaitList.forEach(function(dj) {

                db.get("SELECT strftime('%s', 'now')-strftime('%s', lastActive) AS 'secondsSinceLastActive', lastActive, username, warns, removes FROM USERS LEFT JOIN DISCIPLINE USING(userid) WHERE userid = ?", [dj.id] , function (error, row) {
                    z++;
                    var position = bot.getWaitListPosition(dj.id);
                    db.run('UPDATE USERS SET lastWaitListPosition = ? WHERE userid = ?', [position, dj.id]);

                    if (row != null) {

                        // Only bug idle people if the bot has been running for as long as the minimum idle time
                        if(row.secondsSinceLastActive >= maxIdleTime && moment().isAfter(moment(startupTimestamp).add('minutes', config.plug.activeDJTimeoutMins))) {
                            console.log('[IDLE] ' + position + '. ' + row.username + ' last active '+ moment.utc(row.lastActive).fromNow());
                            if (row.warns > 0) {
                                bot.moderateRemoveDJ(dj.id);
                                bot.sendChat('@' + row.username + ' ' + config.responses.activeDJRemoveMessage);
                                db.run('UPDATE DISCIPLINE SET warns = 0, removes = removes + 1, lastAction = CURRENT_TIMESTAMP WHERE userid = ?', [dj.id]);
                            }
                            else {
                                db.run('UPDATE DISCIPLINE SET warns = warns + 1, lastAction = CURRENT_TIMESTAMP WHERE userid = ?', [dj.id]);
                                idleDJs.push(row.username);
                            }
                        }
                        else {
                            if(dj.permission > 1) {
                                roomHasActiveMods = true;
                            }
                            console.log('[ACTIVE] ' + position + '. ' + row.username + ' last active '+ moment.utc(row.lastActive).fromNow());
                        }
                    }

                    if (z == idleWaitList.length) {

                        if(idleDJs.length > 0) {
                            var idleDJsList = idleDJs.join(' @');
                            bot.sendChat('@' + idleDJsList + ' ' + config.responses.activeDJReminder);
                        }

                        // Only police this if there aren't any mods around
                        if(!roomHasActiveMods && config.maxSongLengthSecs > 0 && data.media.duration > config.maxSongLengthSecs) {
                            console.log('[SKIP] Skipped ' + data.dj.user.username + ' spinning a song of ' + data.media.duration + ' seconds');
                            bot.sendChat('Sorry @' + data.dj.user.username + ', this song is over our maximum room length of ' + (config.maxSongLengthSecs / 60) + ' minutes.');
                            bot.moderateForceSkip();
                        }
                    }
                });
            });*/
        }

        // Cleanup functions
        // @FIXME - Can't use this since it will remove people while they're in a long line
        //db.run("UPDATE USERS SET lastWaitListPosition = -1 WHERE strftime('%s', 'now')-strftime('%s', lastSeen) > 600");

    });

    bot.on('djUpdate', function(data) {
        if (config.verboseLogging) {
            console.log('DJ update', JSON.stringify(data, null, 2));
        }

        curUserList = bot.getUsers();
        curUserList.forEach(function(dj) {
            var position = bot.getWaitListPosition(dj.id);
            db.run('UPDATE USERS SET lastWaitListPosition = ? WHERE userid = ?', [position, dj.id]);
        });
    });

    if (config.plug.requireWootInLine || config.plug.activeDJTimeoutMins > 0) {
        setInterval(function () {
            monitorDJList();
        }, 5000);
    }

    bot.on('close', reconnect);
    bot.on('error', reconnect);

    function addUserToDb(user) {
        db.run('INSERT OR IGNORE INTO USERS VALUES (?, ?, ?, ?, ?, -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [user.id, user.username, user.language, user.dateJoined.replace('T', ' '), user.avatarID]);
        db.run('UPDATE USERS SET username = ?, language = ?, lastSeen = CURRENT_TIMESTAMP WHERE userid = ?', [user.username, user.language, user.id]);
        db.run('INSERT OR REPLACE INTO DISCIPLINE VALUES(?, 0, 0, 0, CURRENT_TIMESTAMP)', [user.id]);

    }

    function getUserFromDb(user, callback) {
        db.get("SELECT *, strftime('%s', 'now')-strftime('%s', lastSeen) AS 'secondsSinceLastSeen', strftime('%s', 'now')-strftime('%s', lastActive) AS 'secondsSinceLastActive' FROM USERS LEFT JOIN DISCIPLINE USING(userid) WHERE userid = ?", [user.id], function (error, row) {
            callback(row);
        });
    }

    function reconnect() {
        bot.connect(config.plug.roomName);
    }

    function monitorDJList() {

        if (config.plug.prohibitMehInLine) {
            mehWaitlist = bot.getWaitList();
            mehWaitlist.forEach(function(dj) {
                if (dj.vote == '-1') {
                    bot.moderateRemoveDJ(dj.id);
                    bot.sendChat('@' + dj.username + ', voting MEH/Chato/:thumbsdown: while in line is prohibited. Check .rules.');
                }
            });
        }
    }

    function initializeModules(auth) {
        // load context
        require(path.resolve(__dirname, 'context.js'))({auth: auth, config: config});

        // Allow bot to perform multi-line chat
        bot.multiLine = true;
        bot.multiLineLimit = 5;

        // Load commands
        try {
            fs.readdirSync(path.resolve(__dirname, 'commands')).forEach(function(file) {
                var command = require(path.resolve(__dirname, 'commands/' + file));
                commands.push({names: command.names,
                    handler: command.handler,
                    hidden: command.hidden,
                    enabled: command.enabled,
                    matchStart: command.matchStart
                })
            });
        } catch (e) {
            console.error('Unable to load command: ', e);
        }

        initializeDatabase();
    }

    function initializeDatabase() {
        db.run('CREATE TABLE IF NOT EXISTS USERS (userid VARCHAR(255) PRIMARY KEY, username VARCHAR(255), language VARCHAR(10), dateJoined TIMESTAMP, avatarID VARCHAR(255), lastWaitListPosition INTEGER, lastSeen TIMESTAMP, lastActive TIMESTAMP)');
        db.run('CREATE TABLE IF NOT EXISTS SONGS (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), format VARCHAR(255), author VARCHAR(255), cid VARCHAR(255), duration DOUBLE)');
        db.run('CREATE TABLE IF NOT EXISTS PLAYS (id INTEGER PRIMARY KEY AUTOINCREMENT, userid VARCHAR(255), songid VARCHAR(255), upvotes INTEGER, downvotes INTEGER, snags INTEGER, started TIMESTAMP, listeners INTEGER)');
        db.run('CREATE TABLE IF NOT EXISTS SETTINGS (name VARCHAR(255) PRIMARY KEY, value TEXT, userid VARCHAR(255), timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');
        db.run('CREATE TABLE IF NOT EXISTS CHAT (id INTEGER PRIMARY KEY AUTOINCREMENT, message VARCHAR(255), userid VARCHAR(255), timestamp TIMESTAMP)');
        db.run('CREATE TABLE IF NOT EXISTS GIFTS (id INTEGER PRIMARY KEY AUTOINCREMENT, category VARCHAR(255), name VARCHAR(255), chat TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        db.run('CREATE TABLE IF NOT EXISTS DISCIPLINE (userid VARCHAR(255) PRIMARY KEY, warns INTEGER, removes INTEGER, kicks INTEGER, lastAction TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        db.run('CREATE TABLE IF NOT EXISTS FACTS (id integer PRIMARY KEY AUTOINCREMENT, category VARCHAR(255), fact varchar(255) NULL);');
        db.run('CREATE TABLE IF NOT EXISTS SCOTT_PILGRIM (id integer PRIMARY KEY AUTOINCREMENT, quote varchar(255) NULL);');
    }

    function handleCommand(data) {
        // unescape message
        data.message = S(data.message).unescapeHTML().s;

        data.message = data.message.replace(/&#39;/g, '\'');
        data.message = data.message.replace(/&#34;/g, '\"');
        data.message = data.message.replace(/&amp;/g, '\&');
        data.message = data.message.replace(/&lt;/gi, '\<');
        data.message = data.message.replace(/&gt;/gi, '\>');

        var command = commands.filter(function(cmd) {
            var found = false;
            for (i = 0; i < cmd.names.length; i++) {
                if (!found) {
                    found = (cmd.names[i] == data.message.toLowerCase() || (cmd.matchStart && data.message.toLowerCase().indexOf(cmd.names[i]) == 0));
                }
            }
            return found;
        })[0];

        if (command && command.enabled) {

            // @FIXME - not efficient, but convenient!
            room.djs = [];
            bot.getWaitList(function(djs) {
                room.djs = djs;
            });
            room.users = [];
            bot.getUsers(function(users) {
                room.users = users;
            });
            room.media = null;
            bot.getMedia(function(media) {
                room.media = media;
            });

            if (config.verboseLogging) {
                console.log('[COMMAND]', JSON.stringify(data, null, 2));
            }

            command.handler(data);
        }
        else if (data.message.indexOf('@' + config.plug.botName) > -1) {
            //botMentionResponse(data);
        }
    }

    function autoWoot() {
        if (config.plug.autoWoot == 'ALL') {
            bot.woot();
        } else if (config.plug.autoWoot == 'RANKED') {
            if (bot.getDJ().permission >= config.API.ROLE.RESIDENTDJ) {
                bot.woot();
            }
        }
    }

    function correctMetadata() {
        media = bot.getMedia();

        // first, see if the song exists in the db
        db.get('SELECT id FROM SONGS WHERE id = ?', [media.id], function(error, row) {
            if (row == null) {
                // if the song isn't in the db yet, check it for suspicious strings
                artistTitlePair = S((media.author + ' ' + media.title).toLowerCase());
                if (artistTitlePair.contains('official music video')
                    || artistTitlePair.contains('lyrics')
                    || artistTitlePair.contains('|')
                    || artistTitlePair.contains('official video')
                    || artistTitlePair.contains('[')
                    || artistTitlePair.contains('"')
                    || artistTitlePair.contains('*')
                    || artistTitlePair.contains('(HD)')
                    || artistTitlePair.contains('(HQ)')
                    || artistTitlePair.contains('1080p')
                    || artistTitlePair.contains('720p')
                    || artistTitlePair.contains(' - ')
                    || artistTitlePair.contains('full version')
                    || artistTitlePair.contains('album version')) {
                    suggestNewSongMetadata(media.author + ' ' + media.title);
                }
            }
        });
    }

    function suggestNewSongMetadata(valueToCorrect) {
        media = bot.getMedia();
        request('http://developer.echonest.com/api/v4/song/search?api_key=' + config.echoNest.apiKey + '&format=json&results=1&combined=' + S(valueToCorrect).escapeHTML().stripPunctuation().s, function(error, response, body) {
            console.log('echonest body', body);
            if (error) {
                bot.sendChat('An error occurred while connecting to EchoNest.');
                console.log('EchoNest error', error);
            } else {
                response = JSON.parse(body).response;

                room.media.suggested = {
                    author: response.songs[0].artist_name,
                    title: response.songs[0].title
                };

                // log
                console.log('[EchoNest] Original: "' + media.author + '" - "' + media.title + '". Suggestion: "' + room.media.suggested.author + '" - "' + room.media.suggested.title);

                if (media.author != room.media.suggested.author || media.title != room.media.suggested.title) {
                    bot.sendChat('Hey, the metadata for this song looks wrong! Suggested Artist: "' + room.media.suggested.author + '". Title: "' + room.media.suggested.title + '". Type ".fixsong yes" to use the suggested tags.');
                }
            }
        });
    }

    function botMentionResponse(data) {
        var strings = [
            "What year is it?",
            "/me regards {sender} with an alarmed expression.",
            "Anything for you, {sender}! (Well, maybe not *anything*...)",
            "What does a bot need to do to get some peace and quiet around here?",
            "LOL Please stop. You're killing me!",
            "GO TO JAIL. Go directly to jail. Do not pass go, do not collect $200.",
            "Unbelievable. Simply... unbelievable.",
            "I think I've heard this one before, but don't let me stop you.",
            "Are you making fun of me, {sender}?",
            "Momma told me that it's not safe to run with scissors.",
            "Negative. Negative! It didn't go in. It just impacted on the surface.",
            "In this galaxy there's a mathematical probability of three million Earth-type planets. And in the universe, three million million galaxies like this. And in all that, and perhaps more... only one of each of us.",
            "Wait, why am I here?",
            "You have entered a dark area, {sender}. You will likely be eaten by a grue.",
            "/me begins to tell a story.",
            "/me starts singing “The Song That Never Ends”",
            "Ask again later",
            "Reply hazy",
            "/me 's legs flail about as if independent from his body!",
            "/me phones home.",
            "I'm looking for Ray Finkle… and a clean pair of shorts.",
            "Just when I thought you couldn't be any dumber, you go on and do something like this.... AND TOTALLY REDEEM YOURSELF!!",
            "Sounds like somebody’s got a case of the Mondays! :(",
            "My CPU is a neuro-net processor, a learning computer",
            "I speak Jive!",
            "1.21 gigawatts!",
            "A strange game. The only winning move is not to play.",
            "If he gets up, we’ll all get up! It’ll be anarchy!",
            "Does Barry Manilow know you raid his wardrobe?",
            "Face it, {sender}, you’re a neo-maxi zoom dweebie.",
            "MENTOS… the freshmaker",
            "B-E S-U-R-E T-O D-R-I-N-K Y-O-U-R O-V-A-L-T-I-N-E",
            "Back off, man. I'm a scientist.",
            "If someone asks you if you are a god, you say yes!",
            "Two in one box, ready to go, we be fast and they be slow!",
            "/me does the truffle shuffle",
            "I am your father's brother's nephew's cousin's former roommate.",
            "This isn’t the bot you are looking for.",
            "/me turns the volume up to 11.",
            "Negative, ghost rider!",
            "I feel the need, the need for speed!",
            "Wouldn’t you prefer a good game of chess?",
            "I can hip-hop, be-bop, dance till ya drop, and yo yo, make a wicked cup of cocoa.",
            "Why oh why didn’t I take the blue pill?",
            "Roads, {sender}? Where we're going, we don't need roads."
        ];
        var randomIndex = _.random(0, strings.length-1);
        var message = strings[randomIndex];
        bot.sendChat(message.replace('{sender}', data.from));
    }
}