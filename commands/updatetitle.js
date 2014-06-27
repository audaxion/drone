exports.names = ['.updatetitle', '.settitle'];
exports.hidden = true;
exports.enabled = false;
exports.matchStart = true;
exports.handler = function(data) {
    if (_.findWhere(room.users, {id: data.fromID}).permission > 2) {
        var input = data.message.split(' ');
        var title = decodeURI(_.rest(input, 2).join(' '));

        db.get('SELECT author, title FROM SONGS where id = ?', input[1], function(err, row) {
            if (row != null) {
                db.run('UPDATE SONGS SET title = ? WHERE id = ?', [title, input[1]],
                function(error) {
                    if (error) {
                        bot.sendChat('An error occurred.');
                        console.log('Error while updating song ' + input[1], error);
                    } else {
                        bot.sendChat('Title updated.')
                    }
                });
            }
            else {
                bot.sendChat('Song not found for update.  Usage: .updatetitle [songid] [songtitle]');
            }
        });
    } else {
        bot.sendChat('Only managers and hosts are allowed to update song metadata.');
    }
};
