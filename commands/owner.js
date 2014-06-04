exports.names = ['.owner', '.feedback'];
exports.hidden = true;
exports.enabled = true;
exports.matchStart = false;
exports.handler = function (data) {
    bot.sendChat('audaxion owns the drone fork of SparkleBot. Make bug reports and requests here, please: https://github.com/audaxion/drone/issues');
};
