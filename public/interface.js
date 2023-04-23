// SDPX-License-Identifier: BSD-2-Clause

var station = {};
var log = null;
var flagOptions = ["w", "wvid", "taxi"];
var stationTimeout = null;
var dragItem = null;
var mobile = Cookies.get("mobile") != undefined || isMobile();
var realtimeSocket = null;

function publiclog(msg) {
    var i = log.innerHTML.split("\n");
    i.push(msg);
    if (i.length > 4) i = i.splice(-4);
    log.innerHTML = i.join("\n");
}

document.addEventListener("DOMContentLoaded", async function() {
    var ljs = document.getElementById("ljs");
    if (ljs) ljs.remove();

    var auth = Cookies.get("authentication");
    if (typeof(auth) == "undefined" || (await verifyLogin()) != true) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("login").style.display = "block";
    }
    else {
        var info = new URL(window.location.href);

        if (info.searchParams.has("page")) {
            var page = info.searchParams.get("page");
            if (page == "station") {
                if (info.searchParams.has("station")) station_page(info.searchParams.get("station"));
                else landing();
            }
            else landing();
        }
        else landing();
    }
});

function landing() {
    var dragless = document.getElementById("dragless");
    dragless.checked = mobile;
    if (isMobile()) dragless.disabled = true;

    fetch("api/stations").then((data) => data.json()).then(data => {
        document.getElementById("amount").innerHTML = data.amount;
        if (data.amount == 1) document.getElementById("indent").style.display = "none";

        var interface = document.getElementById("interface");

        data.stations.forEach(x => {
            var i = document.createElement("a");
            i.setAttribute("href", "?page=station&station=" + x.name);
            i.innerHTML = x.name;
            interface.appendChild(i);
            interface.appendChild(document.createElement("br"));
        });

        document.getElementById("loading").style.display = "none";
        interface.style.display = "block";
    });
}

function pad2(e, m = 2) {
    var l = e.toString().length;
    var q = m - l;
    if (q < 0) q = 0;
    return "0".repeat(q) + e.toString();
}

function toggle_dragless() {
    if (Cookies.get("mobile") != undefined) Cookies.remove("mobile");
    else Cookies.set("mobile", "true");
}

function update_left(decrease = 0, updateLeft = true) {
    var timeLeft = station.currentSong.len - station.current - decrease;
    var timeMinutes = (timeLeft / 60) | 0;
    var left = document.getElementById("time_left");
    left.innerHTML = pad2(timeMinutes) + ":" + pad2(timeLeft - (timeMinutes * 60));
    if (timeLeft > 0 && updateLeft) setTimeout(update_left.bind(this, decrease + 1, updateLeft), 1000);
}

async function update_station(stationName, updateLeft = true) {
    return new Promise((resolve, reject) => {
        fetch("api/station?station=" + encodeURIComponent(stationName)).then(data => data.json()).then(data => {
            stationTimeout = setTimeout(update_station.bind(this, stationName), (data.currentSong.len - data.current + 5) * 1000);
            station = {
                ...data
            };
            update_left(0, updateLeft);
            rebuild_queue();

            var current = document.getElementById("current_song");
            current.innerHTML = "";
            flagOptions.forEach(x => {
                    if (current.innerHTML != "") current.innerHTML += " ";
                    current.innerHTML += "<a style=\"color: " + (station.currentSong[x] ? "green" : "red") + ";\">" + x + "</a>";
            });
            current.innerHTML = "<b>" + station.currentSong.title + "</b> [" + current.innerHTML + "]";

            resolve();
        });
    });
}

function reindex() {
    var queue = document.getElementById("station_queue");
    var indexes = document.getElementsByClassName("mobileindex");
    var indexesLength = indexes.length.toString().length;
    for (var i = 0; i < indexes.length; i++) {
        indexes[i].innerHTML = " " + pad2((i + 1).toString(), indexesLength) + ".";
    }
}

function rebuild_queue() {
    var queue = document.getElementById("station_queue");
    queue.innerHTML = "";

    var titles = document.createElement("tr");
    
    if (mobile) {
        var __move = document.createElement("th");
        __move.innerHTML = "move";
        titles.appendChild(__move);
    }

    var _title = document.createElement("th");
    _title.innerHTML = "title";
    titles.appendChild(_title);
    var _flags = document.createElement("th");
    _flags.innerHTML = "flags";
    titles.appendChild(_flags);
    var _actions = document.createElement("th");
    _actions.innerHTML = "actions";
    titles.appendChild(_actions);
    queue.appendChild(titles);

    for (var i = 0; i < station.queue.length; i++) {
        var entry = station.queue[i];
        var main = document.createElement("tr");
       
        if (mobile) {
            var _move = document.createElement("td");
            var move = document.createElement("button");
            move.innerHTML = "M";
            move.addEventListener("click", function(e) {
                var moveTo = null;
                while(true) {
                    try {
                        var _moveTo = prompt("after where do you want to move \"" + e.target.parentElement.parentElement.getElementsByClassName("title")[0].innerText + "\"?");
                        if (_moveTo == null) return;
                        moveTo = parseInt(_moveTo);
                        if (moveTo >= 0) break;
                    }
                    catch(e) {
                        continue;
                    }
                }
                var table = e.target.parentElement.parentElement.parentElement;
                var items = table.getElementsByTagName("tr");
                if (moveTo >= items.length) moveTo = items.length - 1;
                items[moveTo].after(e.target.parentElement.parentElement);
                reindex();
            });
            _move.appendChild(move);

            var index = document.createElement("a");
            index.style.fontFamily = "monospace";
            index.innerHTML = " 5.";
            index.classList.add("mobileindex");
            _move.appendChild(index);
            main.appendChild(_move);
        }

        var _title = document.createElement("td");
        _title.setAttribute("data-entry", JSON.stringify(entry));
        _title.classList.add("title");

        var title = document.createElement("a");
        title.href = "about:blank";
        title.style.color = "black";
        title.style.textDecoration = "none";
        title.innerHTML = "<b>" + entry.title + "</b>";
        title.setAttribute("data-id", entry.id);
        title.addEventListener("click", function(e) {
            navigator.clipboard.writeText("https://" + (!mobile ? "www" : "m") + ".youtube.com/watch?v=" + e.target.parentElement.getAttribute("data-id"));
            e.preventDefault();
        });

        if (!mobile) {
            title.setAttribute("draggable", true);
            title.addEventListener("dragstart", function(e) {
                e.dataTransfer.effectAllowed = "move";
                dragItem = e;
            });
            title.addEventListener("dragover", function(e) {
                e.target.style.borderBottom = "2px solid black";
            });
            title.addEventListener("dragleave", function(e) {
                (e.target.parentElement.tagName.toLowerCase() == "b" ? e.target.parentElement : e.target).style.borderBottom = "none";
                if (e.target.parentElement.tagName.toLowerCase() == "b") {
                    var tr = e.target.parentElement.parentElement.parentElement.parentElement;
                    queue.insertBefore(dragItem.target.parentElement.parentElement, tr.nextSibling);
                }
            });
        }

        _title.appendChild(title);
        main.appendChild(_title);

        var flags = document.createElement("td");
        flagOptions.forEach(x => {
            if (flags.innerHTML != "") {
                var i = document.createElement("a");
                i.innerHTML = "&nbsp;";
                flags.appendChild(i);
            }
            var flag = document.createElement("a");
            flag.setAttribute("href", "about:blank");
            flag.style.textDecoration = "none";
            flag.style.color = (entry[x] ? "green" : "red");
            flag.setAttribute("data-set", entry[x].toString());
            flag.innerHTML = x;
            flag.addEventListener("click", function(e) {
                e.preventDefault();
                var set = e.target.getAttribute("data-set").toLowerCase() == "true";
                e.target.setAttribute("data-set", (!set).toString());
                e.target.style.color = set ? "red" : "green";
            });
            flags.appendChild(flag);
        });
        flags.classList.add("flags");
        main.appendChild(flags);

        var actions = document.createElement("td");

        var remove = document.createElement("button");
        remove.innerHTML = "remove";
        remove.addEventListener("click", function(e) {
            if (confirm("really remove \"" + e.target.parentElement.parentElement.getElementsByClassName("title")[0].innerText + "\"?")) e.target.parentElement.parentElement.remove();
        });
        actions.appendChild(remove);

        /*var _space1 = document.createElement("p");
        _space1.innerHTML = "&nbsp;";
        _space1.style.display = "inline";
        actions.appendChild(_space1);

        var moveDown = document.createElement("button");
        moveDown.innerHTML = "move down";
        moveDown.setAttribute("onclick", "moveup(event, true)");
        actions.appendChild(moveDown);*/

        main.appendChild(actions);
        queue.appendChild(main);

        reindex();
    }
}

function moveup(event, back = false) {
    event.target.parentElement.parentElement.parentElement.insertBefore(event.target.parentElement.parentElement, !back ? event.target.parentElement.parentElement.previousSibling : event.target.parentElement.parentElement.nextSibling.nextSibling);
}

async function station_page(stationName) {
    await update_station(stationName);
    log = document.getElementById("station_log");
    var _station = document.getElementById("station");
    document.getElementById("station_name").innerHTML = "managing: " + station.name;
    document.getElementById("loading").style.display = "none";
    _station.style.display = "block";    
}

function savequeue() {
    var queue = document.getElementById("station_queue");
    var new_queue = [];
    for (var i = 1; i < queue.childNodes.length; i++) {
        var title = queue.childNodes[i].getElementsByClassName("title")[0];
        var flags = queue.childNodes[i].getElementsByClassName("flags")[0].getElementsByTagName("a");
        var entry = JSON.parse(title.getAttribute("data-entry"));
        for (var j = 0; j < flags.length; j++) {
            if (flags[j].hasAttribute("data-set")) {
                var set = flags[j].getAttribute("data-set").toLowerCase() == "true";
                entry[flags[j].innerHTML] = set;
            }
        }
        new_queue.push(entry);
    }
    publiclog("saving queue");
    fetch("api/update-queue?station=" + encodeURIComponent(station.name), {
        method: "PUT",
        body: JSON.stringify(new_queue)
    }).then(data => {
        clearTimeout(stationTimeout);
        update_station(station.name, false);
        publiclog("saved queue");
    });
}

function swapitems() {
    var queue = document.getElementById("station_queue");
    queue.insertBefore(queue.childNodes[1], queue.childNodes[3]);
}

function addvideo() {
    var id = null;
    while(true) {
        id = prompt("enter ID or youtube link");
        if (id == null) break;
        id = videoUrlInspector("https://youtu.be/" + id);
        if (id != null && id.hoster == "youtube") {
            id = id.remoteId;
            break;
        }
    }
    if (id == null) return;
    publiclog("looking up id \"" + id + "\"");
    fetch("api/lookup-video-verify?id=" + encodeURIComponent(id)).then(async data => {
        if (data.status == 200) {
            var data2 = await data.json();
            publiclog("getting additional info on \"" + data2.title + "\"");
            fetch("api/lookup-video?id=" + encodeURIComponent(data2.id)).then(async data3 => {
                var data4 = await data3.json();
                var flags_string = "";
                Object.keys(data4.flags).forEach(x => {
                    if (flagOptions.includes(x)) {
                        flags_string += (flags_string == "" ? "" : " ") + x;
                    }
                    else if (x == "start" || x == "end") {
                        if (flags_string != "") flags_string += " ";
                        flags_string += data4.flags[x].toString();
                    }
                });
                var flags = prompt("currently the flags for \"" + data2.title + "\" are \"" + flags_string + "\". would you like to add any?", flags_string);
                var entry = {
                    title: data2.title,
                    channel: data2.author,
                    id: data2.id,
                    len: data4.len
                };
                flagOptions.forEach(flag => {
                    entry[flag] = false;
                });
                var flagsItems = [];
                var stend = [];
                if (flags != null) {
                    flags.split(" ").forEach(flag => {
                        if (flagOptions.includes(flag)) {
                            entry[flag] = true;
                            flagsItems.push(flag);
                        }
                        else if (!isNaN(flag)) {
                            flagsItems.push((stend.length <= 0 ? "start" : "end") + ":" + flag);
                            stend.push(parseInt(flag));
                        }
                    });
                }
                if (stend.length >= 1) entry.start = stend[0];
                if (stend.length >= 2) entry.end = stend[1];
                publiclog("adding \"" + data2.title + "\" with flags \"" + flagsItems.join(" ") + "\"");
                station.queue.unshift(entry);
                rebuild_queue();
            });
        }
        else publiclog("id \"" + id + "\" doesn't exist");
    });
}

function verifyLogin() {
    return new Promise((resolve, reject) => {
        fetch("api/login").then(data => {
            resolve(data.status == 204);
        }).catch(reject);
    });
}

async function login() {
    var username = document.getElementById("username");
    var password = document.getElementById("password");
    
    var _cookie = {
        username: username.value,
        password: sha256(password.value)
    };
    var cookie = btoa(JSON.stringify(_cookie));
    Cookies.set("authentication", cookie, {
        sameSite: "strict"
    });

    if ((await verifyLogin()) == true) window.location.reload();
}

function rescan() {
    publiclog("toggling rescan for " + station.name);
    fetch("api/toggle?action=toggleRescan&station=" + encodeURIComponent(station.name)).then(data => {
        publiclog((data.status == 200 ? "toggled" : "failed to toggle") + " rescan for " + station.name);
    });
}
