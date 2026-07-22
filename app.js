(function () {
  "use strict";

  var LS_LOC = "wx-loc";
  var LS_CACHE = "wx-cache";

  var state = {
    loc: null,
    data: null,
    fetchedAt: null,
    range: 24,
    pollen: null
  };

  var $ = function (id) { return document.getElementById(id); };

  var WMO = {
    0: "CLEAR", 1: "MOSTLY CLR", 2: "PT CLOUDY", 3: "OVERCAST",
    45: "FOG", 48: "RIME FOG",
    51: "LT DRIZZLE", 53: "DRIZZLE", 55: "HV DRIZZLE",
    56: "FRZ DRIZZLE", 57: "FRZ DRIZZLE",
    61: "LT RAIN", 63: "RAIN", 65: "HV RAIN",
    66: "FRZ RAIN", 67: "FRZ RAIN",
    71: "LT SNOW", 73: "SNOW", 75: "HV SNOW", 77: "SNOW GRAINS",
    80: "LT SHOWERS", 81: "SHOWERS", 82: "HV SHOWERS",
    85: "SNOW SHWRS", 86: "SNOW SHWRS",
    95: "THUNDER", 96: "THNDR+HAIL", 99: "THNDR+HAIL"
  };
  function wmo(code) { return WMO[code] || "CODE " + code; }

  /* pollen species + approximate risk bands (grains/m3):
     [low|mod, mod|high, high|veryhigh] */
  var POLLEN = [
    { key: "alder_pollen",   label: "ALDER",   bands: [10, 50, 100] },
    { key: "birch_pollen",   label: "BIRCH",   bands: [10, 50, 100] },
    { key: "grass_pollen",   label: "GRASS",   bands: [30, 70, 150] },
    { key: "mugwort_pollen", label: "MUGWORT", bands: [10, 30, 50] },
    { key: "olive_pollen",   label: "OLIVE",   bands: [20, 50, 200] },
    { key: "ragweed_pollen", label: "RAGWEED", bands: [5, 20, 50] }
  ];
  function riskBand(v, b) {
    if (v < b[0]) return { word: "LOW", cls: "lo" };
    if (v < b[1]) return { word: "MODERATE", cls: "mod" };
    if (v < b[2]) return { word: "HIGH", cls: "hi" };
    return { word: "VERY HIGH", cls: "vh" };
  }
  function riskColor(v, b) {
    if (v < b[0]) return "#169c3c";
    if (v < b[1]) return "#2fff66";
    if (v < b[2]) return "#ffd23c";
    return "#ff5c4d";
  }

  /* ---------- msg strip (info / warn / err) ---------- */
  function msg(text, level) {
    var el = $("msg");
    if (!text) { el.className = "msg-strip"; el.textContent = ""; return; }
    el.textContent = "> " + text;
    el.className = "msg-strip on " + (level || "info");
  }

  /* ---------- storage ---------- */
  function saveLoc() { try { localStorage.setItem(LS_LOC, JSON.stringify(state.loc)); } catch (e) {} }
  function loadLoc() {
    try { var r = localStorage.getItem(LS_LOC); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function saveCache() {
    try {
      localStorage.setItem(LS_CACHE, JSON.stringify({
        loc: state.loc, data: state.data, pollen: state.pollen, fetchedAt: state.fetchedAt
      }));
    } catch (e) {}
  }
  function loadCache() {
    try { var r = localStorage.getItem(LS_CACHE); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }

  /* ---------- header ---------- */
  function renderLocLine() {
    var el = $("loc-line");
    if (!state.loc) { el.textContent = "NO LOCATION SET"; return; }
    var l = state.loc;
    el.innerHTML = "LOC: <b>" + escapeHtml(l.name) + "</b> [" +
      l.lat.toFixed(2) + ", " + l.lon.toFixed(2) + "]";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtStamp(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- fetch ---------- */
  function fetchForecast() {
    if (!state.loc) return;
    msg("FETCHING FORECAST...", "info");
    var url = "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + state.loc.lat +
      "&longitude=" + state.loc.lon +
      "&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m" +
      "&forecast_days=14&timezone=auto";
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) {
        state.data = json;
        state.fetchedAt = new Date().toISOString();
        saveCache();
        msg("");
        renderAll();
        fetchPollen();
      })
      .catch(function (err) {
        var cache = loadCache();
        if (cache && cache.data) {
          state.loc = cache.loc;
          state.data = cache.data;
          state.pollen = cache.pollen || null;
          state.fetchedAt = cache.fetchedAt;
          msg("OFFLINE \u2014 CACHED FORECAST FROM " + fmtStamp(cache.fetchedAt), "warn");
          renderAll();
        } else {
          msg("FETCH FAILED: " + err.message + " \u2014 CHECK CONNECTION", "err");
        }
      });
  }

  function fetchPollen() {
    if (!state.loc) return;
    var url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
      "?latitude=" + state.loc.lat + "&longitude=" + state.loc.lon +
      "&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen" +
      "&timezone=auto";
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) { state.pollen = json; saveCache(); renderPollen(); })
      .catch(function () { renderPollen(); });
  }

  /* ---------- location ---------- */
  var GEO_ERR = { 1: "PERMISSION DENIED", 2: "POSITION UNAVAILABLE", 3: "TIMED OUT" };

  function locate() {
    if (!navigator.geolocation) {
      msg("GEOLOCATION UNAVAILABLE \u2014 USE SEARCH", "warn");
      return;
    }
    msg("REQUESTING POSITION...", "info");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.loc = { name: "CURRENT POSITION", lat: pos.coords.latitude, lon: pos.coords.longitude };
        saveLoc();
        renderLocLine();
        fetchForecast();
      },
      function (err) {
        var reason = GEO_ERR[err.code] || ("ERROR " + err.code);
        var saved = loadLoc();
        if (saved) {
          state.loc = saved;
          renderLocLine();
          msg("POSITION FAILED (" + reason + ") \u2014 USING SAVED LOCATION", "warn");
          fetchForecast();
        } else {
          msg("POSITION FAILED (" + reason + ") \u2014 NO SAVED LOCATION, USE SEARCH", "warn");
        }
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  function doSearch() {
    var q = $("search-input").value.trim();
    if (!q) return;
    var box = $("search-results");
    box.innerHTML = '<li class="cat-item">SEARCHING...</li>';
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(q) + "&count=6&language=en&format=json";
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        box.innerHTML = "";
        var results = json.results || [];
        if (!results.length) {
          box.innerHTML = '<li class="cat-item">NO MATCHES FOR "' + escapeHtml(q.toUpperCase()) + '"</li>';
          return;
        }
        results.forEach(function (r) {
          var label = r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country ? " \u2014 " + r.country : "");
          var li = document.createElement("li");
          li.className = "cat-item";
          li.textContent = label;
          li.addEventListener("click", function () {
            state.loc = { name: r.name, lat: r.latitude, lon: r.longitude };
            saveLoc();
            renderLocLine();
            toggleSearch(false);
            fetchForecast();
          });
          box.appendChild(li);
        });
      })
      .catch(function () {
        box.innerHTML = '<li class="cat-item">SEARCH FAILED \u2014 CHECK CONNECTION</li>';
      });
  }

  function toggleSearch(force) {
    var p = $("search-panel");
    var on = typeof force === "boolean" ? force : !p.classList.contains("on");
    p.classList.toggle("on", on);
    $("btn-search").classList.toggle("on", on);
    if (on) $("search-input").focus();
  }

  /* ---------- forecast page ---------- */
  function renderForecast() {
    var wrap = $("days");
    wrap.innerHTML = "";
    if (!state.data) return;

    var h = state.data.hourly;
    var times = h.time;
    var now = new Date();
    var todayKey = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    var nowHour = pad(now.getHours());

    var days = [];
    var byDate = {};
    for (var i = 0; i < times.length; i++) {
      var dateKey = times[i].slice(0, 10);
      if (!byDate[dateKey]) { byDate[dateKey] = []; days.push(dateKey); }
      byDate[dateKey].push(i);
    }

    var DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    days.forEach(function (dateKey) {
      var idx = byDate[dateKey];
      var tmin = Infinity, tmax = -Infinity, rainSum = 0;
      idx.forEach(function (i) {
        var t = h.temperature_2m[i];
        if (t < tmin) tmin = t;
        if (t > tmax) tmax = t;
        rainSum += h.precipitation[i] || 0;
      });

      var dObj = new Date(dateKey + "T12:00");
      var isToday = dateKey === todayKey;
      var label = (isToday ? "TODAY" : DOW[dObj.getDay()]) +
        " " + pad(dObj.getDate()) + "/" + pad(dObj.getMonth() + 1);

      var day = document.createElement("li");
      day.className = "day" + (isToday ? " open" : "");

      var head = document.createElement("button");
      head.className = "cat-item" + (isToday ? " today" : "");
      head.innerHTML =
        '<span class="dname">' + label + "</span>" +
        '<span class="dstats"><b>' + Math.round(tmin) + "\u00B0/" + Math.round(tmax) + "\u00B0</b>" +
        " \u00B7 " + rainSum.toFixed(1) + "MM</span>";
      head.addEventListener("click", function () { day.classList.toggle("open"); });
      day.appendChild(head);

      var scroll = document.createElement("div");
      scroll.className = "day-hours";
      var rows = "";
      idx.forEach(function (i) {
        var hh = times[i].slice(11, 13);
        var isNow = isToday && hh === nowHour;
        var precip = h.precipitation[i] || 0;
        var prob = h.precipitation_probability[i];
        rows +=
          "<tr" + (isNow ? ' class="now"' : "") + ">" +
          "<td>" + hh + ":00</td>" +
          "<td>" + Math.round(h.temperature_2m[i]) + "\u00B0</td>" +
          '<td class="' + (precip > 0 ? "wet" : "") + '">' + (precip > 0 ? precip.toFixed(1) : "\u2013") + "</td>" +
          "<td>" + (prob == null ? "\u2013" : prob + "%") + "</td>" +
          "<td>" + Math.round(h.wind_speed_10m[i]) + "</td>" +
          '<td class="cond">' + wmo(h.weather_code[i]) + "</td>" +
          "</tr>";
      });
      scroll.innerHTML =
        '<div class="hour-scroll"><table class="hour-table"><thead><tr>' +
        "<th>HR</th><th>T\u00B0C</th><th>MM</th><th>P%</th><th>KMH</th><th>COND</th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>";
      day.appendChild(scroll);
      wrap.appendChild(day);
    });
  }

  /* ---------- rain page ---------- */
  function renderRain() {
    var box = $("rain-chart");
    var totalEl = $("rain-total");
    box.innerHTML = "";
    totalEl.textContent = "";
    if (!state.data) return;

    var h = state.data.hourly;
    var times = h.time;

    var now = new Date();
    var startKey = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" +
      pad(now.getDate()) + "T" + pad(now.getHours());
    var start = 0;
    for (var i = 0; i < times.length; i++) {
      if (times[i].slice(0, 13) >= startKey) { start = i; break; }
    }
    var end = Math.min(start + state.range, times.length);

    var vals = [], labels = [];
    var total = 0, peak = 0, peakIdx = -1;
    for (var j = start; j < end; j++) {
      var v = h.precipitation[j] || 0;
      vals.push(v); labels.push(times[j]); total += v;
      if (v > peak) { peak = v; peakIdx = j - start; }
    }

    var W = 700, H = 300;
    var padL = 44, padR = 12, padT = 14, padB = 34;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var yMax = Math.max(1, Math.ceil(peak * 1.15));
    var n = vals.length;

    // P1 palette
    var FG = "#2fff66", DIM = "#169c3c", BRIGHT = "#9dffba";

    function X(i) { return padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW); }
    function Y(v) { return padT + plotH - (v / yMax) * plotH; }

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Expected precipitation over time">';

    var ySteps = 4;
    for (var g = 0; g <= ySteps; g++) {
      var yv = (yMax / ySteps) * g;
      var yy = Y(yv);
      s += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy +
        '" stroke="' + DIM + '" stroke-width="1" ' + (g > 0 ? 'stroke-dasharray="2,4"' : "") + "/>";
      s += '<text x="' + (padL - 6) + '" y="' + (yy + 4) + '" fill="' + DIM +
        '" font-size="11" text-anchor="end" font-family="monospace">' + yv.toFixed(1) + "</text>";
    }

    var TICK = { 3: 1, 8: 1, 24: 3, 48: 6 };
    for (var k = 0; k < n; k++) {
      var hh = labels[k].slice(11, 13);
      if (hh === "00" && k > 0) {
        s += '<line x1="' + X(k) + '" y1="' + padT + '" x2="' + X(k) + '" y2="' + (padT + plotH) +
          '" stroke="' + DIM + '" stroke-width="1"/>';
      }
      var every = TICK[state.range] || 6;
      if (k % every === 0) {
        s += '<text x="' + X(k) + '" y="' + (H - padB + 16) + '" fill="' + DIM +
          '" font-size="11" text-anchor="middle" font-family="monospace">' + hh + "H</text>";
      }
    }

    if (n > 1) {
      var area = "M " + X(0) + " " + Y(0);
      var line = "";
      for (var m = 0; m < n; m++) {
        var px = X(m), py = Y(vals[m]);
        area += " L " + px + " " + py;
        line += (m === 0 ? "M " : " L ") + px + " " + py;
      }
      area += " L " + X(n - 1) + " " + Y(0) + " Z";
      s += '<path d="' + area + '" fill="rgba(47,255,102,.13)"/>';
      s += '<path d="' + line + '" fill="none" stroke="' + FG + '" stroke-width="2" ' +
        'style="filter: drop-shadow(0 0 4px rgba(47,255,102,.7))"/>';
    }

    if (peak > 0 && peakIdx >= 0) {
      s += '<circle cx="' + X(peakIdx) + '" cy="' + Y(peak) + '" r="3.5" fill="' + BRIGHT + '"/>';
    }

    s += '<text x="' + (padL + plotW / 2) + '" y="' + (H - 4) + '" fill="' + DIM +
      '" font-size="10" text-anchor="middle" font-family="monospace" letter-spacing="2">TIME \u2192</text>';
    s += "</svg>";
    box.innerHTML = s;

    if (total === 0) {
      totalEl.innerHTML = "NO RAIN EXPECTED IN THE NEXT " + state.range + " HOURS";
    } else {
      var peakTime = peakIdx >= 0 ? labels[peakIdx] : null;
      totalEl.innerHTML = "TOTAL: <b>" + total.toFixed(1) + "MM</b>" +
        (peakTime ? " \u00B7 PEAK: <b>" + peak.toFixed(1) + "MM/H</b> AT " +
          peakTime.slice(8, 10) + "/" + peakTime.slice(5, 7) + " " + peakTime.slice(11, 16) : "");
    }
  }

  /* ---------- pollen page ---------- */
  function renderPollen() {
    var box = $("pollen-radar");
    var listEl = $("pollen-list");
    box.innerHTML = "";
    listEl.innerHTML = "";
    if (!state.pollen || !state.pollen.hourly) {
      listEl.innerHTML = '<div class="pollen-empty">POLLEN DATA UNAVAILABLE \u2014 FETCH PENDING OR OFFLINE</div>';
      return;
    }

    var h = state.pollen.hourly;
    var times = h.time;
    var now = new Date();
    var key = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" +
      pad(now.getDate()) + "T" + pad(now.getHours());
    var idx = 0;
    for (var i = 0; i < times.length; i++) {
      if (times[i].slice(0, 13) >= key) { idx = i; break; }
    }

    var any = false;
    var vals = POLLEN.map(function (p) {
      var arr = h[p.key] || [];
      var v = arr[idx];
      if (v != null) any = true;
      return v == null ? null : v;
    });

    if (!any) {
      listEl.innerHTML = '<div class="pollen-empty">NO POLLEN DATA FOR THIS LOCATION \u2014 CAMS COVERS EUROPE ONLY</div>';
      return;
    }

    var FG = "#2fff66", DIM = "#169c3c";
    var W = 320, H = 300, cx = W / 2, cy = 150, R = 96, N = POLLEN.length;
    function ang(i) { return -Math.PI / 2 + i * 2 * Math.PI / N; }
    function pt(i, frac) { var a = ang(i); return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac]; }

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Pollen radar">';

    // hexagonal rings
    for (var g = 1; g <= 4; g++) {
      var f = g / 4, ring = "";
      for (var r1 = 0; r1 < N; r1++) {
        var p = pt(r1, f);
        ring += (r1 ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " ";
      }
      ring += "Z";
      s += '<path d="' + ring + '" fill="none" stroke="' + DIM + '" stroke-width="1" opacity="' +
        (g === 4 ? 0.9 : 0.4) + '"/>';
    }

    // spokes + labels
    for (var k = 0; k < N; k++) {
      var pp = pt(k, 1);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pp[0].toFixed(1) + '" y2="' + pp[1].toFixed(1) +
        '" stroke="' + DIM + '" stroke-width="1" opacity="0.5"/>';
      var lp = pt(k, 1.22);
      var anchor = Math.abs(lp[0] - cx) < 6 ? "middle" : (lp[0] < cx ? "end" : "start");
      s += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3).toFixed(1) + '" fill="' + DIM +
        '" font-size="10" font-family="monospace" text-anchor="' + anchor + '">' + POLLEN[k].label + "</text>";
    }

    // data polygon
    var poly = "";
    for (var d = 0; d < N; d++) {
      var v0 = vals[d] || 0;
      var frac = Math.min(v0 / POLLEN[d].bands[2], 1);
      var dp = pt(d, frac);
      poly += (d ? "L" : "M") + dp[0].toFixed(1) + " " + dp[1].toFixed(1) + " ";
    }
    poly += "Z";
    s += '<path d="' + poly + '" fill="rgba(47,255,102,.16)" stroke="' + FG +
      '" stroke-width="2" style="filter: drop-shadow(0 0 4px rgba(47,255,102,.7))"/>';

    // risk-colored vertices
    for (var c = 0; c < N; c++) {
      var v1 = vals[c] || 0;
      var frac2 = Math.min(v1 / POLLEN[c].bands[2], 1);
      var cp = pt(c, frac2);
      s += '<circle cx="' + cp[0].toFixed(1) + '" cy="' + cp[1].toFixed(1) + '" r="3" fill="' +
        riskColor(v1, POLLEN[c].bands) + '"/>';
    }

    s += "</svg>";
    box.innerHTML = s;

    // list
    var rows = "";
    POLLEN.forEach(function (p, i2) {
      var v = vals[i2];
      var band = (v == null) ? { word: "\u2013", cls: "" } : riskBand(v, p.bands);
      rows += '<div class="pollen-row">' +
        '<span class="pn">' + p.label + "</span>" +
        '<span class="pv">' + (v == null ? "\u2013" : Math.round(v)) + "</span>" +
        '<span class="pr ' + band.cls + '">' + band.word + "</span></div>";
    });
    listEl.innerHTML = rows +
      '<div class="pollen-note">GRAINS/M\u00B3 \u00B7 CURRENT HOUR \u00B7 BANDS APPROXIMATE, NOT MEDICAL ADVICE</div>';
  }

  function renderAll() {
    renderLocLine();
    renderForecast();
    renderRain();
    renderPollen();
  }

  /* ---------- tabs + buttons ---------- */
  function showPage(which) {
    ["forecast", "rain", "pollen"].forEach(function (p) {
      $("page-" + p).classList.toggle("on", which === p);
      $("tab-" + p).classList.toggle("on", which === p);
    });
  }
  $("tab-forecast").addEventListener("click", function () { showPage("forecast"); });
  $("tab-rain").addEventListener("click", function () { showPage("rain"); });
  $("tab-pollen").addEventListener("click", function () { showPage("pollen"); });
  $("btn-locate").addEventListener("click", locate);
  $("btn-search").addEventListener("click", function () { toggleSearch(); });
  $("btn-go").addEventListener("click", doSearch);
  $("search-input").addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
  var RANGES = [3, 8, 24, 48];
  RANGES.forEach(function (hrs) {
    $("rng-" + hrs).addEventListener("click", function () {
      state.range = hrs;
      RANGES.forEach(function (h2) { $("rng-" + h2).classList.toggle("on", h2 === hrs); });
      renderRain();
    });
  });

  /* ---------- boot ---------- */
  var saved = loadLoc();
  if (saved) {
    state.loc = saved;
    renderLocLine();
    fetchForecast();
  } else {
    locate();
  }
})();
