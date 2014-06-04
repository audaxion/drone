exports.names = ['.meh'];
exports.hidden = true;
exports.enabled = false;
exports.matchStart = false;
exports.handler = function (data) {
    bot.sendChat(config.responses.mehReminder);
};