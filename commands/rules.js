exports.names = ['.rules'];
exports.hidden = true;
exports.enabled = true;
exports.matchStart = true;
exports.handler = function (data) {
    if (_.findWhere(room.users, {id: data.fromID}).permission > 1) {
        bot.sendChat("- Accepted Genres (Yes/Si/Да) Future Garage / Bass / Beats / Downtempo / 170 minimal / Deep House / Ambient / Trip-Hop");
        bot.sendChat("- Not These Genres (No/Prohibido/Нет) Chillstep (Blackmill) / Chillwave (Washed Out) / Glitch / Psytrance / Indie / Dance / Electro / Techno / Hip-Hop");
    }
};