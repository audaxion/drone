exports.names = ['.songinfo'];
exports.hidden = false;
exports.enabled = false;
exports.matchStart = true;
exports.handler = function(data) {
    var songId;
    if (data.message.length > 10) {
        songId = data.message.substring(10);
    } else if (room.media != null) {
        songId = room.media.id;
    } else {
        bot.sendChat('No song playing.');
        return;
    }
    
    db.get('SELECT author, title FROM SONGS where id = ?', songId, function(err, row) {
        if (row != null) {
            bot.sendChat('Song ' + songId + ' has this metadata in the DB: Artist: "' 
                + row['author'] + '". Title: "' + row['title'] + '". Use .updateauthor or .updatetitle to change.');
        } else if (songId == room.media.id) {
            bot.sendChat('Song ' + songId + ' does not exist in the DB and will be added with'
                + ' this metadata: Artist: "' + room.media.author + '". Title: "' 
                + room.media.title + '".');
        } else {
            bot.sendChat('Invalid song ID.');
        }
    });
};
