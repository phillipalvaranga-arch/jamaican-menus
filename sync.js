/* Jamaican Menus — private Gist sync.
   Same approach as Business SuccessHQ: per-item merge with tombstones.
   The access token is never logged, never exported, and is sent only to api.github.com. */
(function (root) {
  "use strict";

  var API = "https://api.github.com";
  var GIST_DESC = "Jamaican Menus Sync";
  var GIST_FILE = "menus-data.json";
  var TOKEN_KEY = "jmenus-sync-token";
  var GIST_ID_KEY = "jmenus-sync-gist-id";
  var LAST_KEY = "jmenus-sync-last";

  var LIST_KEYS = ["favorites", "myFoods", "neverEat", "plan", "notes"];
  var FLAG_KEYS = ["shopChecks", "cookChecks"];

  function emptyTombs() {
    var t = {};
    LIST_KEYS.concat(FLAG_KEYS).forEach(function (k) { t[k] = {}; });
    return t;
  }

  function stampOf(item) {
    if (!item || typeof item !== "object") return "";
    return item.updatedAt || item.createdAt || "";
  }

  function laterStamp(a, b) {
    if (!a) return b || "";
    if (!b) return a;
    return a >= b ? a : b;
  }

  function mergeTombMaps(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { out[k] = laterStamp(out[k], b[k]); });
    return out;
  }
  function mergeById(localList, remoteList, localTombs, remoteTombs) {
    var tombs = mergeTombMaps(localTombs, remoteTombs);
    var map = {};
    (localList || []).concat(remoteList || []).forEach(function (item) {
      if (!item || !item.id) return;
      var cur = map[item.id];
      if (!cur || stampOf(item) > stampOf(cur)) map[item.id] = item;
    });
    var list = [];
    var leftover = {};
    Object.keys(tombs).forEach(function (id) { leftover[id] = tombs[id]; });
    Object.keys(map).forEach(function (id) {
      var item = map[id];
      var tomb = tombs[id] || "";
      if (tomb && tomb >= stampOf(item)) return;
      list.push(item);
      delete leftover[id];
    });
    return { list: list, tombstones: leftover };
  }

  function normalizeFlag(entry) {
    if (entry === true) return { value: true, updatedAt: "" };
    if (entry === false || entry == null) return { value: false, updatedAt: "" };
    if (typeof entry !== "object") return { value: entry, updatedAt: "" };
    return { value: entry.value, updatedAt: entry.updatedAt || "" };
  }

  function flattenFlagMap(src, bag, keyFn) {
    Object.keys(src || {}).forEach(function (a) {
      var row = src[a] || {};
      Object.keys(row).forEach(function (b) {
        var k = keyFn(a, b);
        bag[k] = { a: a, b: b, entry: normalizeFlag(row[b]) };
      });
    });
  }

  function mergeFlagMaps(localS, remoteS, localTombs, remoteTombs) {
    var tombs = mergeTombMaps(localTombs, remoteTombs);
    var bag = {};
    var remoteBag = {};
    flattenFlagMap(localS, bag, function (a, b) { return a + "|" + b; });
    flattenFlagMap(remoteS, remoteBag, function (a, b) { return a + "|" + b; });
    Object.keys(remoteBag).forEach(function (k) {
      if (!bag[k] || remoteBag[k].entry.updatedAt > bag[k].entry.updatedAt) bag[k] = remoteBag[k];
    });
    var leftover = {};
    Object.keys(tombs).forEach(function (k) { leftover[k] = tombs[k]; });
    var out = {};
    Object.keys(bag).forEach(function (k) {
      var rec = bag[k];
      var tomb = tombs[k] || "";
      if (tomb && tomb >= (rec.entry.updatedAt || "")) return;
      delete leftover[k];
      if (!out[rec.a]) out[rec.a] = {};
      out[rec.a][rec.b] = rec.entry;
    });
    return { map: out, tombstones: leftover };
  }

  function mergeSettings(localS, remoteS, localTimes, remoteTimes) {
    var keys = {};
    Object.keys(localS || {}).forEach(function (k) { keys[k] = true; });
    Object.keys(remoteS || {}).forEach(function (k) { keys[k] = true; });
    var values = {};
    var times = {};
    Object.keys(keys).forEach(function (k) {
      var lt = (localTimes || {})[k] || "";
      var rt = (remoteTimes || {})[k] || "";
      if (rt > lt) {
        values[k] = (remoteS || {})[k];
        times[k] = rt;
      } else {
        values[k] = (localS || {})[k];
        times[k] = lt || rt;
      }
    });
    return { settings: values, settingsTimes: times };
  }

  function mergeStates(local, remote) {
    local = local || {};
    remote = remote || {};
    var lt = local.tombstones || emptyTombs();
    var rt = remote.tombstones || emptyTombs();
    var out = { version: 1 };
    var tombs = emptyTombs();
    LIST_KEYS.forEach(function (key) {
      var m = mergeById(local[key], remote[key], lt[key], rt[key]);
      out[key] = m.list;
      tombs[key] = m.tombstones;
    });
    FLAG_KEYS.forEach(function (key) {
      var m = mergeFlagMaps(local[key], remote[key], lt[key], rt[key]);
      out[key] = m.map;
      tombs[key] = m.tombstones;
    });
    var setM = mergeSettings(local.settings, remote.settings, local.settingsTimes, remote.settingsTimes);
    out.settings = setM.settings;
    out.settingsTimes = setM.settingsTimes;
    out.tombstones = tombs;
    return out;
  }

  function syncPayload(state) {
    var data = { version: 1 };
    LIST_KEYS.forEach(function (k) { data[k] = state[k] || []; });
    FLAG_KEYS.forEach(function (k) { data[k] = state[k] || {}; });
    data.settings = state.settings || {};
    data.settingsTimes = state.settingsTimes || {};
    data.tombstones = state.tombstones || emptyTombs();
    return { app: "jamaican-menus", version: 1, updatedAt: new Date().toISOString(), data: data };
  }

  function parsePayload(raw) {
    if (!raw) return null;
    var parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && parsed.data) return parsed.data;
    if (parsed && (Array.isArray(parsed.myFoods) || Array.isArray(parsed.plan))) return parsed;
    return null;
  }

  function maskToken(token) {
    var t = String(token || "");
    if (t.length < 8) return "••••";
    return "••••" + t.slice(-4);
  }

  function readStore(key) {
    try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
  }
  function writeStore(key, val) {
    try {
      if (val == null || val === "") localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) {}
  }

  function getToken() { return readStore(TOKEN_KEY); }
  function setToken(token) {
    var t = String(token || "").trim();
    writeStore(TOKEN_KEY, t);
  }
  function clearToken() {
    writeStore(TOKEN_KEY, "");
    writeStore(GIST_ID_KEY, "");
  }
  function getGistId() { return readStore(GIST_ID_KEY); }
  function setGistId(id) { writeStore(GIST_ID_KEY, id || ""); }
  function getLastSync() { return readStore(LAST_KEY); }
  function setLastSync(iso) { writeStore(LAST_KEY, iso || ""); }

  function parseNextLink(link) {
    if (!link) return "";
    var parts = link.split(",");
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/<([^>]+)>;\s*rel="next"/);
      if (m) return m[1];
    }
    return "";
  }

  function apiUrlOk(url) {
    try {
      return new URL(url, API).origin === API;
    } catch (e) {
      return false;
    }
  }

  function gh(token, url, opts) {
    if (!apiUrlOk(url)) return Promise.reject(new Error("Sync can only talk to api.github.com"));
    opts = opts || {};
    var headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body || undefined
    });
  }

  function statusError(res) {
    if (res.status === 401 || res.status === 403) {
      return "That token was not accepted. Check that you copied the whole token and that it has the gist permission.";
    }
    if (res.status === 404) return "The synced copy could not be found. Try connecting again.";
    if (res.status === 422) return "GitHub could not save the synced copy. Try again in a moment.";
    return "GitHub returned an error (" + res.status + "). Try again in a moment.";
  }

  function listGists(token) {
    var all = [];
    function page(url) {
      return gh(token, url).then(function (res) {
        if (!res.ok) return Promise.reject(new Error(statusError(res)));
        return res.json().then(function (items) {
          if (Array.isArray(items)) all = all.concat(items);
          var next = parseNextLink(res.headers.get("Link"));
          if (next && apiUrlOk(next)) return page(next);
          return all;
        });
      });
    }
    return page(API + "/gists?per_page=100");
  }

  function findExistingGist(token) {
    return listGists(token).then(function (gists) {
      var matches = (gists || []).filter(function (g) {
        if (!g || g.description !== GIST_DESC) return false;
        if (g.files && g.files[GIST_FILE]) return true;
        return !!g.files;
      });
      matches.sort(function (a, b) {
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });
      return matches[0] || null;
    });
  }

  function filesBody(content) {
    var files = {};
    files[GIST_FILE] = { content: content };
    return files;
  }

  function createGist(token, content) {
    return gh(token, API + "/gists", {
      method: "POST",
      body: JSON.stringify({
        description: GIST_DESC,
        public: false,
        files: filesBody(content)
      })
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  function getGist(token, id) {
    return gh(token, API + "/gists/" + encodeURIComponent(id)).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  function readGistData(gist) {
    if (!gist || !gist.files) return null;
    var file = gist.files[GIST_FILE] || gist.files[Object.keys(gist.files)[0]];
    if (!file) return null;
    if (file.truncated) {
      throw new Error("The synced copy is too large to read through GitHub's API. Export a backup from each device and try again, or keep using a backup file.");
    }
    if (!file.content) return null;
    return parsePayload(file.content);
  }

  function patchGist(token, id, content) {
    return gh(token, API + "/gists/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify({
        files: filesBody(content)
      })
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  var MenuSync = {
    GIST_DESC: GIST_DESC,
    GIST_FILE: GIST_FILE,
    TOKEN_KEY: TOKEN_KEY,
    GIST_ID_KEY: GIST_ID_KEY,
    LAST_KEY: LAST_KEY,
    emptyTombs: emptyTombs,
    stampOf: stampOf,
    mergeStates: mergeStates,
    mergeById: mergeById,
    mergeFlagMaps: mergeFlagMaps,
    mergeSettings: mergeSettings,
    syncPayload: syncPayload,
    parsePayload: parsePayload,
    maskToken: maskToken,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getGistId: getGistId,
    setGistId: setGistId,
    getLastSync: getLastSync,
    setLastSync: setLastSync,
    findExistingGist: findExistingGist,
    createGist: createGist,
    getGist: getGist,
    readGistData: readGistData,
    patchGist: patchGist,
    listGists: listGists,
    LIST_KEYS: LIST_KEYS,
    FLAG_KEYS: FLAG_KEYS
  };

  if (typeof module !== "undefined" && module.exports) module.exports = MenuSync;
  root.MenuSync = MenuSync;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
