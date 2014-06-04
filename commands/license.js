exports.names = ['.license'];
exports.hidden = true;
exports.enabled = true;
exports.matchStart = false;
exports.handler = function(data) {
    bot.sendChat('MIT License - Full license available at http://github.com/audaxion/drone/blob/master/LICENSE');
};
