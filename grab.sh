#!/bin/sh
yt-dlp --flat-playlist --dump-single-json "https://www.youtube.com/playlist?list=PLfWdliuzOIZO_ZsVtGYWmb--2fojcEfEa" | node -e "const fs=require('fs');
const path=require('path');
var i = [];
var ca = '';
process.stdin.on('data', (c) => {
    ca += c.toString();
});
process.stdin.on('end', () => {
    var e = JSON.parse(ca);
    var w = [];
    var v = [];
    var taxi = [];
    var special_time_items = [];
    var special_time = {};
    var items = e.description.split('\n');
    var flags = 'n';
    for (var d = 0; d < items.length; d++) {
        if (items[d] == 'widescreen') flags = 'w';
        if (items[d] == 'wvid') flags = 'v';
        if (items[d] == 'stend') flags = 's';
        if (items[d] == 'taxi') flags = 't';
        if ((flags == 'w' || flags == 'v') && items[d].length == 11) w.push(items[d]);
        if (flags == 'v' && items[d].length == 11) {
            w.push(items[d]);
            v.push(items[d]);
        }
        if (flags == 't' && items[d].length == 11) {
            w.push(items[d]);
            taxi.push(items[d]);
        }
        if (flags == 's') {
            var item = items[d].split(' ');
            if (item.length >= 2) {
                special_time_items.push(item[0]);
                var ob = { start: parseInt(item[1]) };
                if (item.length >= 3) ob.end = parseInt(item[2]);
                special_time[item[0]] = ob;
            }
        }
    }
    for (var q = 0; q < e.entries.length; q++) {
        var id = e.entries[q].id;
        var ido = {title:e.entries[q].title,channel:e.entries[q].channel,id:id,w:w.includes(id),len:e.entries[q].duration,wvid:v.includes(id),taxi:taxi.includes(id)};
        var idz = {};
        if (w.includes(id)) idz.w = true;
        if (v.includes(id)) idz.wvid = true;
        if (taxi.includes(id)) idz.taxi = true;
        if (Object.keys(special_time).includes(id)) {
            if (Object.keys(special_time[id]).includes('start')) {
                ido.start = special_time[id].start;
                idz.start = ido.start;
            }
            if (Object.keys(special_time[id]).includes('end')) {
                ido.end = special_time[id].end;
                idz.end = ido.end;
            }
        }
        i.push(ido);
        var datapath = path.join(__dirname, 'data', id + '.json');
        fs.writeFileSync(datapath, JSON.stringify(idz, null, '    ') + '\n');
    }
    console.log(JSON.stringify(i, null, '    '));
});" > _content.json
mv _content.json content.json # because it breaks the scheduler when getting overwritten
