exports.names = ['.emoji'];
exports.hidden = true;
exports.enabled = true;
exports.matchStart = false;
exports.handler = function (data) {
    if (_.findWhere(room.users, {id: data.fromID}).permission > 1) {
        bot.sendChat('Emoji List: http://www.emoji-cheat-sheet.com');
    }
};