exports.names = ['.help'];
exports.hidden = false;
exports.enabled = false;
exports.matchStart = false;
exports.handler = function (data) {
    bot.sendChat('Need help? Ask a mod! No mods around? http://plug.dj/support');
};