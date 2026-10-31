/* Type Along: type lyrics while a YouTube video plays. The video pauses until you finish each line. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "typealong-songs";

  /* ---------- storage (localStorage: link + lyrics + timings only) ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function store(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  /* ---------- YouTube IFrame API ---------- */
  var ytReady = false, ytQueue = [], players = {};
  window.onYouTubeIframeAPIReady = function () { ytReady = true; ytQueue.splice(0).forEach(function (f) { f(); }); };
  function whenYT(f) { (ytReady || (window.YT && window.YT.Player)) ? f() : ytQueue.push(f); }
  function ytError(c) {
    if (c === 2) return "That does not look like a valid YouTube video link.";
    if (c === 100) return "This video was not found, or it is private.";
    if (c === 101 || c === 150) return "The owner of this video does not allow it to be played outside YouTube.";
    if (c === 153) return "YouTube refused to play. Open this page from a web server (http://localhost or a website), not as a file.";
    return "The video could not be played (error " + c + ").";
  }
  function killPlayer(slot) {
    try { if (players[slot]) players[slot].destroy(); } catch (e) {}
    delete players[slot]; $(slot).innerHTML = "";
  }
  function makePlayer(slot, videoId, controls, onReady) {
    killPlayer(slot);
    var d = document.createElement("div"); $(slot).appendChild(d);
    $("ytErr").hidden = true;
    whenYT(function () {
      new YT.Player(d, {
        videoId: videoId, width: "100%", height: "100%",
        playerVars: { controls: controls, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1 },
        events: {
          onReady: function (e) {
            if (!$(slot).contains(e.target.getIframe())) return;
            players[slot] = e.target; if (onReady) onReady(e.target);
          },
          onError: function (e) { $("ytErr").hidden = false; $("ytErr").textContent = ytError(e.data); }
        }
      });
    });
  }
  function videoId(s) {
    s = s.trim();
    var m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : null);
  }

  /* ---------- views ---------- */
  function show(v) {
    ["lib", "add", "play"].forEach(function (x) { $(x).hidden = x !== v; });
    $("tLib").setAttribute("aria-pressed", v === "lib"); $("tAdd").setAttribute("aria-pressed", v === "add");
    $("ytErr").hidden = true;
    if (v !== "play") stopPlay();
    if (v !== "add") killPlayer("syncSlot");
    if (v === "lib") renderLib();
    if (v === "add") step(1);
  }
  $("tLib").onclick = function () { show("lib"); };
  $("tAdd").onclick = function () { show("add"); };
  $("pback").onclick = $("rback").onclick = function () { show("lib"); };

  function renderLib() {
    var box = $("list"), songs = load(); box.innerHTML = "";
    if (!songs.length) { box.innerHTML = '<p class="muted" style="margin:0">No songs yet. Open Admin: add song to add a YouTube link and lyrics.</p>'; return; }
    songs.slice().reverse().forEach(function (s) {
      var d = document.createElement("div"); d.className = "song";
      var l = document.createElement("div"), n = document.createElement("b"), m = document.createElement("small");
      n.textContent = s.title; m.textContent = s.lines.length + " lines"; l.appendChild(n); l.appendChild(m);
      var r = document.createElement("div"); r.className = "row";
      var p = document.createElement("button"); p.className = "main"; p.textContent = "Play"; p.onclick = function () { openSong(s); };
      var x = document.createElement("button"); x.textContent = "Delete";
      x.onclick = function () { store(load().filter(function (q) { return q.id !== s.id; })); renderLib(); };
      r.appendChild(p); r.appendChild(x); d.appendChild(l); d.appendChild(r); box.appendChild(d);
    });
  }

  /* ---------- lyrics parsing: SRT/VTT, LRC, or plain lines ---------- */
  function parseLyrics(txt) {
    txt = txt.replace(/\r/g, ""); var out = [];
    if (txt.indexOf("-->") > -1) {
      txt.split(/\n\s*\n/).forEach(function (b) {
        var ls = b.split("\n"), i = ls.findIndex(function (l) { return l.indexOf("-->") > -1; });
        if (i < 0) return;
        var m = ls[i].match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)\s*-->/); if (!m) return;
        var t = (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (+("0." + m[4]));
        var s = ls.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
        if (s) out.push({ t: t, text: s });
      });
      return { lines: out, timed: true };
    }
    var rows = txt.split("\n").map(function (l) { return l.trim(); }).filter(Boolean), lrc = [];
    rows.forEach(function (l) {
      var m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      if (m && m[3]) lrc.push({ t: (+m[1]) * 60 + (+m[2]), text: m[3] });
    });
    if (lrc.length && lrc.length >= rows.length / 2) return { lines: lrc, timed: true };
    return { lines: rows.map(function (x) { return { t: 0, text: x }; }), timed: false };
  }
  $("file").onchange = function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { $("lyr").value = r.result; }; r.readAsText(f);
  };

  /* ---------- admin: add + sync ---------- */
  var sy = null;
  function step(n) {
    $("s1").hidden = n !== 1; $("syncBox").hidden = n === 1;
    $("s2").hidden = n !== 2; $("s3").hidden = n !== 3;
  }
  $("go").onclick = function () {
    var id = videoId($("url").value), title = $("title").value.trim(), res = parseLyrics($("lyr").value);
    var e = $("e1");
    if (!id) { e.textContent = "Paste a YouTube link."; return; }
    if (!title) { e.textContent = "Add a title."; return; }
    if (!res.lines.length) { e.textContent = "Add some lyrics."; return; }
    e.textContent = "";
    sy = { id: id, title: title, lines: res.lines.map(function (x) { return x.text; }),
           times: res.timed ? res.lines.map(function (x) { return x.t; }) : [] };
    makePlayer("syncSlot", id, 1);
    if (res.timed) { drawReview(); step(3); } else { step(2); drawSync(); }
  };
  function drawSync() {
    var i = sy.times.length;
    $("sline").textContent = sy.lines[i] || ""; $("snext").textContent = sy.lines[i + 1] || "";
    $("sprog").textContent = "Line " + Math.min(i + 1, sy.lines.length) + " of " + sy.lines.length;
  }
  function mark() {
    var pl = players.syncSlot; if (!sy || $("s2").hidden || !pl) return;
    sy.times.push(Math.round(pl.getCurrentTime() * 100) / 100);
    if (sy.times.length >= sy.lines.length) { pl.pauseVideo(); drawReview(); step(3); } else drawSync();
  }
  function undo() { if (sy && sy.times.length) { sy.times.pop(); drawSync(); } }
  $("mark").onclick = mark; $("undo").onclick = undo;
  document.addEventListener("keydown", function (e) {
    if ($("add").hidden || $("s2").hidden || /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); mark(); }
    if (e.key === "Backspace") { e.preventDefault(); undo(); }
  });
  function drawReview() {
    var box = $("rev"); box.innerHTML = "";
    sy.lines.forEach(function (txt, i) {
      var d = document.createElement("div"); d.className = "line";
      var a = document.createElement("span"); a.textContent = txt;
      var r = document.createElement("span"); r.className = "row";
      var tm = document.createElement("span"); tm.className = "time"; tm.textContent = sy.times[i].toFixed(1) + "s";
      function nudge(dx) { return function () { sy.times[i] = Math.max(0, Math.round((sy.times[i] + dx) * 10) / 10); tm.textContent = sy.times[i].toFixed(1) + "s"; }; }
      var m = document.createElement("button"); m.textContent = "−"; m.onclick = nudge(-0.1);
      var p = document.createElement("button"); p.textContent = "+"; p.onclick = nudge(0.1);
      var j = document.createElement("button"); j.textContent = "Jump";
      j.onclick = function () { var pl = players.syncSlot; if (pl) { pl.seekTo(Math.max(0, sy.times[i] - 0.5), true); pl.playVideo(); } };
      [m, tm, p, j].forEach(function (x) { r.appendChild(x); });
      d.appendChild(a); d.appendChild(r); box.appendChild(d);
    });
  }
  $("redo").onclick = function () { sy.times = []; if (players.syncSlot) players.syncSlot.seekTo(0, true); step(2); drawSync(); };
  $("save").onclick = function () {
    for (var i = 1; i < sy.times.length; i++) {
      if (sy.times[i] < sy.times[i - 1]) { $("e3").textContent = "Line " + (i + 1) + " starts before line " + i + ". Fix the times so they go forward."; return; }
    }
    $("e3").textContent = "";
    var songs = load();
    songs.push({ id: Date.now(), videoId: sy.id, title: sy.title,
                 lines: sy.lines.map(function (t, i) { return { t: sy.times[i], text: t }; }) });
    store(songs); sy = null; $("title").value = ""; $("lyr").value = ""; $("url").value = ""; $("file").value = "";
    show("lib");
  };

  /* ---------- play ---------- */
  var p = null, raf = 0, shown = -1;
  function openSong(s) {
    show("play");
    p = { song: s, k: 0, pos: 0, target: "", good: 0, total: 0, t0: 0, started: false, stalled: false, player: null };
    shown = -1; $("res").hidden = true; $("pb").hidden = true; $("pstart").hidden = false;
    $("pt").textContent = "Press Start, then type each line as it appears."; $("pn").textContent = "";
    setLine(0); stats();
    makePlayer("playSlot", s.videoId, 0, function (pl) { if (p) p.player = pl; });
  }
  function stopPlay() { cancelAnimationFrame(raf); killPlayer("playSlot"); p = null; }
  function skip() { while (p.pos < p.target.length && !/[a-z0-9\u00C0-\uFFFF ]/i.test(p.target[p.pos])) p.pos++; }
  function setLine(k) {
    p.k = k; if (k >= p.song.lines.length) return;
    p.target = p.song.lines[k].text; p.pos = 0; skip();
  }
  function avail(t) { return p.started && p.k < p.song.lines.length && t >= p.song.lines[p.k].t - 0.05; }
  function draw() {
    if (!p || !p.started || p.k >= p.song.lines.length) return;
    var box = $("pt"); box.innerHTML = "";
    if (!shown) { box.textContent = "Next line is coming up…"; $("pn").textContent = ""; return; }
    for (var i = 0; i < p.target.length; i++) {
      var s = document.createElement("span"); s.className = "c" + (i < p.pos ? " ok" : i === p.pos ? " cur" : "");
      s.textContent = p.target[i] === " " ? "\u00A0" : p.target[i]; box.appendChild(s);
    }
    var nx = p.song.lines[p.k + 1]; $("pn").textContent = nx ? nx.text : "";
  }
  function stats() {
    var mins = p.t0 ? Math.max((Date.now() - p.t0) / 60000, 1 / 600) : 0;
    $("pw").textContent = mins ? Math.round(p.good / 5 / mins) : 0;
    $("pa").textContent = (p.total ? Math.round(p.good / p.total * 100) : 100) + "%";
    $("pl").textContent = Math.min(p.k + 1, p.song.lines.length) + "/" + p.song.lines.length;
  }
  function loop() {
    if (!p) return;
    var L = p.song.lines, pl = p.player, t = pl.getCurrentTime();
    if (p.k < L.length) {
      var deadline = p.k + 1 < L.length ? L[p.k + 1].t : (pl.getDuration() || 1e9) - 0.4;
      var a = avail(t);
      if (a && !p.stalled && pl.getPlayerState() === 1 && t >= deadline - 0.05) { pl.pauseVideo(); p.stalled = true; $("pb").hidden = false; }
      if (a !== shown) { shown = a; draw(); }
    }
    raf = requestAnimationFrame(loop);
  }
  $("pstart").onclick = function () {
    if (!p) return;
    if (!p.player) { $("pt").textContent = "Loading the video…"; return; }
    p.started = true; $("pstart").hidden = true; shown = -1;
    p.player.playVideo(); cancelAnimationFrame(raf); loop();
  };
  function replay() {
    if (!p || !p.started || !p.player || p.k >= p.song.lines.length) return;
    p.pos = 0; skip(); p.stalled = false; $("pb").hidden = true; shown = -1;
    p.player.seekTo(Math.max(0, p.song.lines[p.k].t), true); p.player.playVideo();
  }
  $("preplay").onclick = replay;
  function lineDone() {
    var last = p.k + 1 >= p.song.lines.length;
    if (p.stalled) { p.stalled = false; $("pb").hidden = true; if (!last) p.player.playVideo(); }
    if (last) { finish(); return; }
    setLine(p.k + 1); shown = -1; stats();
  }
  function finish() {
    cancelAnimationFrame(raf); p.player.pauseVideo(); stats();
    $("rw").textContent = $("pw").textContent; $("ra").textContent = $("pa").textContent;
    $("pb").hidden = true; $("res").hidden = false; p.k = p.song.lines.length;
  }
  $("again").onclick = function () { var s = p.song; stopPlay(); openSong(s); };
  document.addEventListener("keydown", function (e) {
    if (!p || $("play").hidden) return;
    if (e.key === "Tab") { e.preventDefault(); replay(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || !p.player || !avail(p.player.getCurrentTime())) return;
    e.preventDefault();
    if (!p.t0) p.t0 = Date.now();
    p.total++;
    if (e.key.toLowerCase() === p.target[p.pos].toLowerCase()) {
      p.good++; p.pos++; skip();
      if (p.pos >= p.target.length) { stats(); lineDone(); return; }
      draw();
    } else {
      var cur = $("pt").children[p.pos];
      if (cur) { cur.classList.add("no"); setTimeout(function () { cur.classList.remove("no"); }, 180); }
    }
    stats();
  });

  show("lib");
})();
