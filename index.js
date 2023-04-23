// SPDX-License-Identifier: BSD-2-Clause

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const querystring = require("querystring");
const httpolyglot = require("httpolyglot");
const stream_replace = require("stream-replace");
const mrmime = require("mrmime");
const strict_cookie_parser = require("strict-cookie-parser");
const ytdl = require("ytdl-core");

const users = require(path.join(__dirname, "users.json"));
const users2 = Object.keys(users);

const config = require(path.join(__dirname, "config.json"));
const package_json = require(path.join(__dirname, "package.json"));
const publicdir = path.join(__dirname, "public", "/");

var https_cert = {};
if (config.ssl.enabled != false) https_cert = {
    cert: fs.readFileSync(config.ssl.cert),
    key: fs.readFileSync(config.ssl.key)
};

function shuffle(arr) {
    for (var i = 0; i < arr.length; i++) {
        var swapIndex = Math.floor(Math.random() * arr.length);
        var temp = arr[i];
        arr[i] = arr[swapIndex];
        arr[swapIndex] = temp;
    }
    return arr;
}

function broadcast(name) {
    var props = config.stationsAdapted[name];
    if (props.queue.length <= 2) props.queue = props.queue.concat([...(shuffle(require(props.file)))]);
    if (props.rescanFlag) {
        props.queue = [...(shuffle(require(props.file)))];
        props.rescanFlag = false;
    }
    props.current++;
    if (props.currentSong.len - 4 < props.current || (props.currentSong._end > 0 && (props.currentSong._end - 4) < props.current)) {
        props.currentSong = props.queue.shift();
        if (Object.keys(props.currentSong).includes("start")) props.currentSong._start = props.currentSong.start;
        else props.currentSong._start = 0;
        if (Object.keys(props.currentSong).includes("end")) props.currentSong._end = props.currentSong.end;
        else props.currentSong._end = -1;
        props.current = props.currentSong._start;
    }
    var response = {
        id: props.currentSong.id,
        start: props.currentSong._start,
        end: props.currentSong._end,
        castLen: props.current,
        w: props.currentSong.w,
        wvid: props.currentSong.wvid,
        taxi: props.currentSong.taxi
    };
    config.stationsPlaylist[name] = JSON.stringify(response);
}

config.stationsList = [];
config.stationsPlaylist = {};
config.stationsAdapted = {};
config.stations.forEach(x => {
    config.stationsList.push(x.name);
    config.stationsPlaylist[x.name] = "";
    config.stationsAdapted[x.name] = {
        ...x,
        rescanFlag: false,
        queue: [],
        current: 0,
        currentSong: { len: 0, end: 0 },
    };
    broadcast(x.name);
    setInterval(broadcast.bind(this, x.name), 1000);
});

function return_404(response, rescode = 404, res = "404 Not Found") {
    response.writeHead(rescode, {
        "Content-Type": "text/plain"
    });
    response.end(res);
}

function return_403(response) {
    return return_404(response, 403, "403 Forbidden");
}

function return_405(response) {
    return return_404(response, 405, "405 Method Not Allowed");
}

function return_400(response) {
    return return_404(response, 400, "400 Bad Request");
}

function return_204(response) {
    return return_404(response, 204, "");
}

function serve_file(filepath, response, restricted = true) {
    if (!filepath.startsWith(publicdir) && restricted) return return_403(response);
    if (!fs.existsSync(filepath)) return return_404(response);
    var mime = mrmime.lookup(filepath);
    response.writeHead(200, {
        "Content-Type": (typeof(mime) == "undefined" ? "application/octet-stream" : mime)
    });
    fs.createReadStream(filepath).pipe(stream_replace(/%{VERSION}/g, package_json.version)).pipe(response);
}

function check_has(obj, values) {
    var objkeys = Object.keys(obj);
    var passes = true;
    for (var i = 0; i < values.length; i++) {
        if (!objkeys.includes(values[i])) {
            passes = false;
            break;
        }
    }
    return passes;
}

function http_handler(request, response) {
    var cookies = null;
    if (Object.keys(request.headers).includes("cookie")) cookies = strict_cookie_parser.parseCookieHeader(request.headers["cookie"]);
    if (cookies == null) cookies = new Map();

    var url = new URL(request.url, "http://ori.gin");
    if (url.pathname.startsWith("/api")) {
        // libs
        if (url.pathname == "/api/js.cookie.min.js") return serve_file(path.join(__dirname, "node_modules", "js-cookie", "dist", "js.cookie.min.js"), response, false);
        if (url.pathname == "/api/sha256.min.js") return serve_file(path.join(__dirname, "node_modules", "js-sha256", "build", "sha256.min.js"), response, false);
        if (url.pathname == "/api/videoUrlInspector.js") return serve_file(path.join(__dirname, "node_modules", "democracyos-video-url-inspector", "build", "videoUrlInspector.js"), response, false);
        if (url.pathname == "/api/is-mobile.js") return serve_file(path.join(__dirname, "node_modules", "is-mobile", "index.js"), response, false);

        // authentication cookies
        if (!cookies.has("authentication")) return return_403(response);
        var authorized = false;
        var authentication = {};
        var _authentication = cookies.get("authentication");
        try {
            var _authentication2 = JSON.parse(Buffer.from(_authentication, "base64").toString("utf-8"));
            if (users2.includes(_authentication2.username)) {
                var _authentication3 = users[_authentication2.username];
                if (_authentication2.password == _authentication3.password_hash) {
                    authentication = _authentication2;
                    authorized = true;
                }
            }
        }
        catch(e) {}
        if (!authorized) return return_403(response);

        if (url.pathname == "/api/login") {
            response.writeHead(204);
            return response.end();
        }
        else if (url.pathname == "/api/stations") {
            return response.end(JSON.stringify({
                amount: config.stations.length,
                stations: config.stations
            }));
        }
        else if (url.pathname == "/api/station") {
            if (!url.searchParams.has("station")) return return_404(response);
            var station = url.searchParams.get("station");
            if (!config.stationsList.includes(station)) return return_404(response);
            response.setHeader("Content-Type", "application/json");
            return response.end(JSON.stringify(config.stationsAdapted[station]));
        }
        else if (url.pathname == "/api/toggle") {
            if (!url.searchParams.has("action") || !url.searchParams.has("station")) return return_404(response);
            var station = url.searchParams.get("station");
            if (!config.stationsList.includes(station)) return return_404(response);
            var action = url.searchParams.get("action");
            if (action == "toggleRescan") {
                config.stationsAdapted[station].rescanFlag = true;
                return response.end("OK");
            }
            else return return_404(response);
        }
        else if (url.pathname == "/api/lookup-video-verify") {
            if (!url.searchParams.has("id")) return return_404(response);
            var id = url.searchParams.get("id");
            if (id.length != 11) return return_404(response);
            https.get("https://www.youtube.com/oembed?url=https://youtu.be/" + id, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
                },
                family: 4
            }, (res) => {
                var body = "";
                res.on("data", (chunk) => {
                    body += chunk.toString();
                });
                res.on("end", () => {
                    var info = {};
                    if (res.statusCode == 200) info = JSON.parse(body);
                    else {
                        response.writeHead(404);
                        return response.end("404 Not Found\n");
                    }
                    
                    var resp = {
                        title: info.title,
                        author: info.author_name,
                        id: id
                    };

                    response.setHeader("Content-Type", "application/json");
                    response.end(JSON.stringify(resp));
                });
            });
            return;
        }
        else if (url.pathname == "/api/lookup-video") {
            if (!url.searchParams.has("id")) return return_404(response);
            var id = url.searchParams.get("id");
            if (id.length != 11) return return_404(response);
            ytdl.getBasicInfo(id, {
                requestOptions: {
                    family: 4
                }
            }).then(data => {
                var resp = {
                    len: parseInt(data.videoDetails.lengthSeconds),
                    flags: {}
                };
                var format = data.formats.filter(format => {
                    return format.mimeType.startsWith("video");
                }).sort((a, b) => {
                    return (a.width - b.width) + (a.height - b.height);
                })[0];
                if ((format.width / 16) == (format.height / 9)) resp.flags.w = true;
                var infofile = path.join(config.flag_db, id + ".json");
                if (fs.existsSync(infofile)) resp.flags = {
                    ...require(infofile)
                };
                response.setHeader("Content-Type", "application/json");
                response.end(JSON.stringify(resp));
            });
            return;
        }
        else if (url.pathname == "/api/update-queue") {
            if (request.method != "PUT") return return_405(response);
            if (!url.searchParams.has("station")) return return_404(response);
            var station = url.searchParams.get("station");
            if (!config.stationsList.includes(station)) return return_404(response);

            var body = "";
            request.on("data", (chunk) => {
                body += chunk.toString();
            });
            request.on("end", () => {
                try {
                    var queue = JSON.parse(body);
                    config.stationsAdapted[station].queue = [...queue];
                    return_204(response);
                }
                catch(e) {
                    return_400(response);
                }
            });

            return;
        }

        return return_404(response);
    }
    else if (url.pathname == "/list") {
        if (!url.searchParams.has("station")) return return_404(response);
        var station = url.searchParams.get("station");
        if (!config.stationsList.includes(station)) return return_404(response);
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Access-Control-Allow-Origin", config.stationsAdapted[station].cors);
        return response.end(config.stationsPlaylist[station]);
    }

    if (url.pathname == "/") url.pathname = "/index.html";
    var filepath = path.join(publicdir, url.pathname);
    serve_file(filepath, response);
}

if (config.ssl.enabled != "same-port") {
    http.createServer(http_handler).listen(config.port, config.socket, () => {
        console.log("[http] listening on :" + config.port);
    });
}
if (config.ssl.enabled == "same-port") {
    httpolyglot.createServer(https_cert, http_handler).listen(config.port, config.socket, () => {
        console.log("[http/https] listening on :" + config.port);
    });
}
if (config.ssl.enabled == true) {
    https.createServer(https_cert, http_handler).listen(config.ssl.port, config.ssl.socket, () => {
        console.log("[https] listening on :" + config.ssl.port);
    });
}
