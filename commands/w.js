// Instructs the bot to woot a song. Only available for bouncers and higher.
exports.names = ['.w'];
exports.hidden = true;
exports.enabled = true;
exports.matchStart = false;
exports.handler = function(data) {
    /*if (_.findWhere(room.users, {id: data.fromID}).permission > 1) {
        bot.woot();
    }*/
    bot.hasPermission(data.fromID, API.ROLE.BOUNCER, function() {
        bot.woot();
    });

};