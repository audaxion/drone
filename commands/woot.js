exports.names = ['.woot'];
exports.hidden = true;
exports.enabled = false;
exports.matchStart = true;
exports.handler = function (data) {
    if (_.findWhere(room.users, {id: data.fromID}).permission > 1) {

        var message = "";
        var input = _.rest(data.message.split(' '), 1).join(' ').trim();
        if (input.length > 1) {
            message = input + ' ';
        }

        message += config.responses.wootReminder;
        bot.sendChat(message);
    }
};