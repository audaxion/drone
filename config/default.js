module.exports = {
    port: process.env.PORT || 8080,
    lastFm: {
        apiKey: process.env.LASTFM_API_KEY || '',
        apiSecret: process.env.LASTFM_API_SECRET || '',
        username: process.env.LASTFM_USERNAME || '',
        password: process.env.LASTFM_PASSWORD || ''
    },
    echoNest: {
        apiKey: process.env.ECHONEST_API_KEY || ''
    },
    plug: {
        botName: process.env.PLUG_BOT_NAME || 'drone',
        auth: process.env.PLUG_AUTH || '',
        roomName: process.env.PLUG_ROOM || 'acth',
        autoWoot: process.env.PLUG_AUTOWOOT || 'ALL',
        autoSuggestCorrections: process.env.PLUG_AUTOSUGGEST || true,
        stopBotOnConnectionLoss: process.env.PLUG_STOP_ON_CONNECTION_LOSS || true,
        welcomeUsers: process.env.PLUG_WELCOME_USERS || 'NONE',
        requireWootInLine: process.env.PLUG_REQUIRE_WOOT || false,
        prohibitMehInLine: process.env.PLUG_PROHIBIT_MEH || false,
        activeDJTimeoutMins: process.env.PLUG_DJ_TIMEOUT || 0,
        maxSongLengthSecs: process.env.PLUG_MAX_SONG_LENGTH || 0
    },
    API: {
        ROLE: {
            ADMIN: 10,
            AMBASSADOR: 8,
            HOST: 5,
            COHOST: 4,
            MANAGER: 3,
            BOUNCER: 2,
            RESIDENTDJ: 1,
            NONE: 0
        },
        STATUS: {
            GAMING: 3,
            WORKING: 2,
            AFK: 1,
            AVAILABLE: 0
        },
        BAN: {
            HOUR: 60,
            DAY: 1440,
            PERMA: -1
        }
    },
    verboseLogging: process.env.VERBOSE_LOGGING || false
}