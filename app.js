/* ===================== helpers ===================== */
const $ = (s, r = document) => r.querySelector(s);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const fdate = i => i
  ? new Date(i).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  : "-";

const fdt = i => i
  ? new Date(i).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "-";

const ico = n => `<i class="bi bi-${n}"></i>`;

const safeUrl = u => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
};

const phx = (s = 36) => `<svg width="${s}" height="${s}" viewBox="0 0 200 200" aria-hidden="true"><use href="#phx"/></svg>`;

const CATEGORIES = [
  "Web Development",
  "Mobile App",
  "Game Development",
  "Desktop Software",
  "AI / Machine Learning",
  "Data Science",
  "DevOps / Tools",
  "Other"
];

const STATUSES = ["Looking for Contributors", "In Progress", "On Hold", "Completed"];

const CAT_ICON = {
  "Web Development": "globe2",
  "Mobile App": "phone",
  "Game Development": "controller",
  "Desktop Software": "pc-display",
  "AI / Machine Learning": "cpu",
  "Data Science": "bar-chart-line",
  "DevOps / Tools": "gear-wide-connected",
  "Other": "box"
};

const STATUS_CLS = {
  "Looking for Contributors": "red",
  "In Progress": "amber",
  "On Hold": "gray",
  "Completed": "green"
};

const statusBadge = s => `<span class="badge ${STATUS_CLS[s] || "gray"}">${esc(s)}</span>`;

const empty = (i, t, p, action = "") => `<div class="empty">${ico(i)}<h5>${esc(t)}</h5><p>${esc(p)}</p>${action}</div>`;

/* Background art generated in code (flames + embers), so no image files are needed */
(function art() {
  let a = 11;

  const rnd = () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const W = 1600,
    H = 520,
    ri = (x, y) => Math.floor(x + rnd() * (y - x + 1));

  const flame = (base, lo, hi, n, col, op) => {
    const st = (W + 80) / n;
    let d = `M-40 ${H + 10} L-40 ${base}`;

    for (let i = 0; i < n; i++) {
      const x = -40 + i * st,
        h = ri(lo, hi),
        l = ri(-18, 18);
      d += ` Q${x + st * .2} ${base - h * .45} ${x + st * .5 + l} ${base - h} Q${x + st * .75} ${base - h * .3} ${x + st} ${base}`;
    }

    return `<path d="${d} L${W + 40} ${H + 10}Z" fill="${col}" opacity="${op}"/>`;
  };

  let s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='xMidYMax slice'><defs><linearGradient id='k' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#121a30'/><stop offset='.6' stop-color='#1c2540'/><stop offset='1' stop-color='#3a1f2a'/></linearGradient></defs><rect width='${W}' height='${H}' fill='url(#k)'/>`;

  for (let i = 0; i < 70; i++) {
    s += `<circle cx='${ri(0, W)}' cy='${ri(40, 430)}' r='${[1, 1.5, 2, 2.5, 3][ri(0, 4)]}' fill='#f0c070' opacity='${(.15 + rnd() * .45).toFixed(2)}'/>`;
  }

  s += flame(420, 120, 230, 11, "#86271a", .55)
     + flame(455, 90, 190, 15, "#c0502a", .6)
     + flame(490, 60, 140, 20, "#e3a64a", .7)
     + "</svg>";

  const pat = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M24 6l6 6-6 6-6-6zM0 30l6 6-6 6zM48 30l-6 6 6 6z' fill='#a98446' opacity='.16'/></svg>`;

  const r = document.documentElement.style;
  r.setProperty("--flames", `url("data:image/svg+xml,${encodeURIComponent(s)}")`);
  r.setProperty("--pattern", `url("data:image/svg+xml,${encodeURIComponent(pat)}")`);
})();

/* ===================== data layer (Firebase Authentication + Realtime Database) ===================== */
const fauth = firebase.auth(),
  db = firebase.database();

const Store = (() => {
  // live copy of the database
  const C = { users: {}, projects: {}, zips: {}, reqsA: {}, reqsU: {}, reqsO: {}, marks: {}, logs: {} };

  let me = null,
    off = [],
    startP = null,
    registering = false,
    timer = 0;

  const now = () => new Date().toISOString();
  const uid = () => db.ref().push().key;
  const list = o => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
  const reqMap = () => ({ ...C.reqsA, ...C.reqsU, ...C.reqsO });

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // redraw the page when data changes, but never while someone is typing
      const t = document.activeElement && document.activeElement.tagName;
      if (/^#\/(share|edit|login|register)/.test(location.hash) || /^(INPUT|TEXTAREA|SELECT)$/.test(t) || document.getElementById("pvFrame")) return;
      route(true);
    }, 80);
  };

  const watch = (ref, fn) => {
    const h = s => {
      fn(s.val() || {});
      changed();
    };
    ref.on("value", h, e => console.warn("Realtime Database:", e.message));
    off.push(() => ref.off("value", h));
  };

  const stop = () => {
    off.forEach(f => f());
    off = [];
    Object.assign(C, { users: {}, reqsA: {}, reqsU: {}, reqsO: {}, marks: {}, logs: {} });
    me = null;
  };

  const errMsg = e => ({
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network problem. Check your internet connection."
  }[e.code] || e.message);

  // projects and zip details are public, so they load for everyone, even before login
  const loaded = new Promise(res => db.ref("projects").on("value", s => {
    C.projects = s.val() || {};
    res();
    changed();
  }, e => {
    console.error(e);
    res();
  }));

  db.ref("zips").on("value", s => {
    C.zips = s.val() || {};
    changed();
  }, () => {});

  const SEED = [
    ["Campus Event Planner", "A web app to create and manage college events. Event creation and RSVP work. Still missing: email reminders, a calendar view and an admin login.", "Web Development", "Looking for Contributors", ["HTML", "CSS", "JavaScript", "Node.js"]],
    ["Pocket Budget", "Android expense tracker with categories and monthly totals. Charts are half done and cloud backup has not been started.", "Mobile App", "In Progress", ["Kotlin", "SQLite"]],
    ["Pixel Dungeon Crawler", "A 2D roguelike prototype. Movement, combat and two levels are done. Needs more enemies, sound and a save system.", "Game Development", "Looking for Contributors", ["C#", "Unity"]],
    ["Resume Parser", "Python tool that reads PDF resumes and extracts skills. Works on simple layouts; fails on two-column resumes.", "AI / Machine Learning", "On Hold", ["Python", "spaCy"]],
    ["Library Manager", "Desktop software for small libraries: issue and return books, fines. Finished, looking for testers and documentation.", "Desktop Software", "Completed", ["Java", "MySQL"]]
  ];

  // first admin login only: adds the 5 demo projects
  async function seed() {
    if ((await db.ref("meta/seeded").get()).val()) return;

    const up = { "meta/seeded": true };

    SEED.forEach((s, i) => {
      up["projects/" + uid()] = {
        name: s[0],
        description: s[1],
        category: s[2],
        status: s[3],
        technologies: s[4],
        githubUrl: "",
        imageUrl: "",
        downloadUrl: "",
        allowDownload: false,
        ownerId: me.id,
        ownerName: "Phoenix Team",
        contributorCount: i === 4 ? 3 : i % 3,
        createdAt: new Date(Date.now() - i * 864e5 * 3).toISOString(),
        updatedAt: now()
      };
    });

    await db.ref().update(up);
  }

  async function start(u) {
    stop();

    const s = await db.ref("users/" + u.uid).get();
    if (!s.exists()) {
      if (!registering) await fauth.signOut();
      return;
    }

    const v = s.val();
    me = { id: u.uid, fullName: v.fullName, username: v.username, email: v.email, role: v.role || "user" };

    if (me.role === "admin") {
      watch(db.ref("users"), o => C.users = o);
      watch(db.ref("requests"), o => C.reqsA = o);
      watch(db.ref("logs").orderByChild("at").limitToLast(1000), o => C.logs = o);
      seed().catch(e => console.warn("Seed:", e.message));
    } else {
      watch(db.ref("requests").orderByChild("userId").equalTo(u.uid), o => C.reqsU = o);
      watch(db.ref("requests").orderByChild("ownerId").equalTo(u.uid), o => C.reqsO = o);
      watch(db.ref("logs").orderByChild("ownerId").equalTo(u.uid), o => C.logs = o);
    }

    watch(db.ref("bookmarks/" + u.uid), o => C.marks = o);
  }

  const begin = u => (startP && startP.uid === u.uid)
    ? startP
    : (startP = Object.assign(start(u), { uid: u.uid }));

  const mkReq = (type, user, project, message) => ({
    projectId: project.id,
    projectName: project.name,
    ownerId: project.ownerId,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email,
    message,
    type,
    status: "pending",
    createdAt: now()
  });

  const S = {
    uid,
    now,

    log(type, user, project, text) {
      const u = fauth.currentUser,
        p = user || me || {};

      if (!u) return Promise.resolve();

      return db.ref("logs").push({
        at: now(),
        type,
        userId: u.uid,
        userName: p.fullName || "",
        userEmail: p.email || "",
        projectId: project ? project.id : "",
        projectName: project ? project.name : "",
        ownerId: project ? project.ownerId : "",
        text: text || ""
      }).catch(e => console.warn("log:", e.message));
    },

    logs: () => list(C.logs).sort((a, b) => b.at.localeCompare(a.at)),
    users: () => list(C.users),

    async setRole(id, role) {
      const x = C.users[id];
      await db.ref("users/" + id + "/role").set(role);
      S.log("role_change", me, null, `Role of ${x ? x.fullName : id} set to ${role}`);
    },

    async deleteUser(id) {
      const x = C.users[id],
        up = {};

      S.projects().filter(p => p.ownerId === id).forEach(p => {
        up["projects/" + p.id] = null;
        up["zips/" + p.id] = null;
        up["zipData/" + p.id] = null;
      });

      S.requests().filter(r => r.userId === id || r.ownerId === id).forEach(r => up["requests/" + r.id] = null);

      up["bookmarks/" + id] = null;
      up["users/" + id] = null;
      if (x && x.username) up["usernames/" + x.username.toLowerCase()] = null;

      await db.ref().update(up);
      S.log("user_deleted", me, null, "Account deleted by admin: " + (x ? x.fullName : id));
    },

    projects: () => list(C.projects).map(p => ({
      githubUrl: "",
      imageUrl: "",
      downloadUrl: "",
      allowDownload: false,
      contributorCount: 0,
      ...p,
      technologies: Object.values(p.technologies || {})
    })),

    project: id => S.projects().find(p => p.id === id) || null,

    async addProject(p, by) {
      const { id, ...d } = p;
      await db.ref("projects/" + id).set(d);
      S.log("project_created", by, p, "Shared a new project");
      return p;
    },

    async updateProject(id, ch) {
      await db.ref("projects/" + id).update({ ...ch, updatedAt: now() });
      return S.project(id);
    },

    async deleteProject(id) {
      const p = S.project(id),
        up = { ["projects/" + id]: null, ["zips/" + id]: null, ["zipData/" + id]: null };

      S.requests().filter(r => r.projectId === id).forEach(r => up["requests/" + r.id] = null);

      await db.ref().update(up);
      if (p) S.log("project_deleted", me, p, "Project deleted");
    },

    zips: () => C.zips,
    zip: id => C.zips[id] || null,
    setZip: m => db.ref("zips/" + m.projectId).set(m),

    requests: () => list(reqMap()),
    contribution: (u, p) => S.requests().find(r => r.id === p + "_" + u) || null,
    downloadRequest: (u, p) => S.requests().find(r => r.id === p + "_" + u + "_download") || null,
    hasDownloadAccess: (u, p) => (S.downloadRequest(u, p) || {}).status === "accepted",

    async requestContribution(user, project, message) {
      const r = mkReq("contribute", user, project, message);
      await db.ref("requests/" + project.id + "_" + user.id).set(r);
      S.log("request", user, project, "Asked to contribute");
      return r;
    },

    async requestDownload(user, project, message) {
      const ex = S.downloadRequest(user.id, project.id);
      if (ex) return ex;

      const r = mkReq("download", user, project, message);
      await db.ref("requests/" + project.id + "_" + user.id + "_download").set(r);
      S.log("request", user, project, "Asked to download the project files");
      return r;
    },

    async setRequestStatus(id, status) {
      const r = S.requests().find(x => x.id === id);
      if (!r) return;

      if (!me || me.id !== r.ownerId) throw new Error("Only the project owner can approve or reject this request.");

      const was = r.status,
        kind = r.type || "contribute",
        p = S.project(r.projectId);

      await db.ref("requests/" + id).update({
        status,
        decidedById: me.id,
        decidedByName: me.fullName,
        decidedAt: now()
      });

      const d = kind === "contribute" && p
        ? (status === "accepted" && was !== "accepted"
          ? 1
          : was === "accepted" && status !== "accepted"
            ? -1
            : 0)
        : 0;

      if (d) await db.ref("projects/" + p.id + "/contributorCount").transaction(n => Math.max(0, (n || 0) + d));

      S.log("request_" + status, me, p, `${kind === "download" ? "Download" : "Contribute"} request from ${r.userName} ${status} by project owner ${me.fullName}`);
    },

    isBookmarked: (u, p) => !!C.marks[p],

    toggleBookmark: (u, p) => S.isBookmarked(u, p)
      ? db.ref("bookmarks/" + u + "/" + p).remove()
      : db.ref("bookmarks/" + u + "/" + p).set(now()),

    bookmarked: () => Object.keys(C.marks).map(k => S.project(k)).filter(Boolean),

    exportAll: () => ({
      users: S.users(),
      projects: S.projects(),
      requests: S.requests(),
      zips: C.zips,
      logs: S.logs()
    })
  };

  S.auth = {
    current: () => me,

    async register({ fullName, username, email, password }) {
      email = email.toLowerCase();
      const key = username.toLowerCase();

      if ((await db.ref("usernames/" + key).get()).exists()) throw new Error("This username is taken.");

      registering = true;
      try {
        const cred = await fauth.createUserWithEmailAndPassword(email, password).catch(e => { throw new Error(errMsg(e)); });

        try {
          await db.ref("usernames/" + key).set(cred.user.uid);
        } catch {
          await cred.user.delete();
          throw new Error("This username is taken.");
        }

        try {
          await db.ref("users/" + cred.user.uid).set({
            fullName,
            username,
            email,
            role: "user",
            createdAt: now(),
            lastLoginAt: ""
          });
        } catch (e) {
          throw new Error("Account created but the profile could not be saved. Publish database.rules.json first. (" + e.message + ")");
        }

        await S.log("register", { fullName, email }, null, "Created an account");
        await fauth.signOut();
      } finally {
        registering = false;
      }
    },

    async login(email, password, remember) {
      await fauth.setPersistence(firebase.auth.Auth.Persistence[remember ? "LOCAL" : "SESSION"]);

      let cred;
      try {
        cred = await fauth.signInWithEmailAndPassword(email, password);
      } catch (e) {
        throw new Error(errMsg(e));
      }

      await begin(cred.user);
      if (!me) throw new Error("This account has been removed. Please contact the admin.");

      db.ref("users/" + me.id + "/lastLoginAt").set(now()).catch(() => {});
      S.log("login", me, null, "Logged in");
      return me;
    },

    async changePassword(id, oldPw, newPw) {
      const u = fauth.currentUser;

      try {
        await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, oldPw));
      } catch {
        throw new Error("Current password is incorrect.");
      }

      try {
        await u.updatePassword(newPw);
      } catch (e) {
        throw new Error(errMsg(e));
      }

      S.log("password", me, null, "Changed password");
    },

    logout() {
      startP = null;
      stop();
      fauth.signOut();
    }
  };

  S.ready = new Promise(res => {
    let first = true;

    fauth.onAuthStateChanged(async u => {
      if (u) {
        try {
          await begin(u);
        } catch (e) {
          console.error(e);
        }
      } else {
        stop();
        startP = null;
      }

      if (first) {
        first = false;
        await Promise.race([loaded, new Promise(r => setTimeout(r, 6000))]);
        res();
      } else {
        changed();
      }
    });
  });

  return S;
})();

const Auth = Store.auth;

/* Zip files are stored inside the Realtime Database (base64), so they are limited to 5 MB. Cloud Storage would need the paid Blaze plan. */
const ZipStore = (() => {
  const MAX = 5 * 1024 * 1024;

  const size = b => b < 1024
    ? b + " B"
    : b < 1048576
      ? (b / 1024).toFixed(1) + " KB"
      : (b / 1048576).toFixed(1) + " MB";

  const b64 = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(new Error("Could not read the file."));
    r.readAsDataURL(f);
  });

  async function validate(f) {
    if (!f) return "Choose a .zip file.";
    if (!/\.zip$/i.test(f.name)) return "Only .zip files are allowed.";
    if (!f.size) return "This file is empty.";
    if (f.size > MAX) return "File is too large. The limit is 5 MB.";

    const h = new Uint8Array(await f.slice(0, 2).arrayBuffer());
    if (h[0] !== 0x50 || h[1] !== 0x4B) return "This does not look like a valid zip file.";

    return null;
  }

  return {
    MAX,
    validate,
    size,

    async save(pid, file, allow = false) {
      const e = await validate(file);
      if (e) throw new Error(e);

      const u = Auth.current(),
        p = Store.project(pid);

      if (!u || !p || (p.ownerId !== u.id && u.role !== "admin")) throw new Error("Only the project owner can upload files.");

      await db.ref("zipData/" + pid).set(await b64(file));

      const m = {
        projectId: pid,
        name: file.name,
        size: file.size,
        allowDownload: !!allow,
        uploadedAt: Store.now(),
        ownerId: p.ownerId,
        uploadedBy: u.id
      };

      await Store.setZip(m);
      Store.log("upload", u, p, `Uploaded ${file.name} (${size(file.size)})`);
      return m;
    },

    async setAllow(pid, on) {
      if (!Store.zip(pid)) return;
      await db.ref("zips/" + pid + "/allowDownload").set(!!on);
      Store.log("permission", Auth.current(), Store.project(pid), on ? "Downloads turned ON" : "Downloads turned OFF");
    },

    async remove(pid, silent) {
      const p = Store.project(pid);
      await db.ref().update({ ["zips/" + pid]: null, ["zipData/" + pid]: null });
      if (!silent) Store.log("zip_removed", Auth.current(), p, "Removed the zip file");
    },

    async download(pid) {
      const u = Auth.current(),
        m = Store.zip(pid),
        p = Store.project(pid);

      if (!u) throw new Error("Please log in to download.");
      if (!m || !p) throw new Error("File not found.");

      if (!(m.allowDownload || p.ownerId === u.id || u.role === "admin" || Store.hasDownloadAccess(u.id, pid))) {
        throw new Error("The owner has not enabled downloads for this project. Send a download request to the owner.");
      }

      let s;
      try {
        s = await db.ref("zipData/" + pid).get();
      } catch {
        throw new Error("You do not have permission to download this file.");
      }

      if (!s.exists()) throw new Error("File data is missing.");

      const blob = new Blob([Uint8Array.from(atob(s.val()), c => c.charCodeAt(0))], { type: "application/zip" });

      Store.log("download", u, p, "Downloaded " + m.name);

      const url = URL.createObjectURL(blob),
        a = document.createElement("a");

      a.href = url;
      a.download = m.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };
})();

/* ===================== UI helpers: toast, modal, forms ===================== */
function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

function modal({ title, body, ok = "OK", cancel = "Cancel", danger = false, onOk }) {
  return new Promise(res => {
    const m = $("#modal");

    m.innerHTML = `<div class="overlay"><div class="dialog" role="dialog" aria-modal="true"><h4>${esc(title)}</h4><div>${body}</div><div class="dfoot">${cancel ? `<button class="btn plain" data-r="0">${esc(cancel)}</button>` : ""}<button class="btn ${danger ? "danger" : "primary"}" data-r="1">${esc(ok)}</button></div></div></div>`;

    const dlg = $(".dialog", m),
      key = e => {
        if (e.key === "Escape") close(false);
      };

    const close = v => {
      m.innerHTML = "";
      document.removeEventListener("keydown", key);
      res(v);
    };

    document.addEventListener("keydown", key);

    m.querySelector(".overlay").addEventListener("mousedown", e => {
      if (e.target.classList.contains("overlay")) close(false);
    });

    m.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
      if (b.dataset.r === "1" && onOk && onOk(dlg) === false) return;
      close(b.dataset.r === "1");
    });

    const f = dlg.querySelector("textarea,input");
    if (f) f.focus();
  });
}

const ask = (title, text, ok = "Confirm", danger = false) => modal({
  title,
  body: `<p class="mb0">${esc(text)}</p>`,
  ok,
  danger
});

function check(form, rules) {
  let ok = true;

  for (const [id, test, msg] of rules) {
    const el = form.querySelector("#" + id),
      v = el.type === "checkbox" ? el.checked : el.value.trim();

    const bad = !test(v);
    el.classList.toggle("bad", bad);

    const e = form.querySelector("#e-" + id);
    if (e) e.textContent = bad ? msg : "";

    if (bad) ok = false;
  }

  return ok;
}

const fld = (id, label, type = "text", extra = "", help = "") => `<div class="field"><label class="label" for="${id}">${label}</label><input class="input" id="${id}" type="${type}" ${extra}>${help ? `<div class="help">${help}</div>` : ""}<div class="err" id="e-${id}"></div></div>`;

const go = h => {
  if (location.hash === h) route(true);
  else location.hash = h;
};

function needLogin() {
  sessionStorage.setItem("phx_next", location.hash || "#/");
  toast("Please log in to continue.");
  go("#/login");
  return ["", null];
}

/* ===================== shared parts ===================== */
function renderNav() {
  const u = Auth.current(),
    h = location.hash || "#/";

  const L = (href, label, test) => `<a href="${href}" class="${test ? "on" : ""}">${label}</a>`;

  $("#nav").innerHTML = `<div class="wrap"><a class="brand" href="#/">${phx(34)}Phoenix Hub</a>
    <button class="burger" onclick="A.burger()" aria-label="Menu">${ico("list")}</button>
    <nav class="links">${L("#/", "Home", h === "#/" || h === "#")}${L("#/explore", "Explore", /^#\/(explore|project)/.test(h))}${L("#/share", "Share a Project", /^#\/(share|edit)/.test(h))}${u ? L("#/dashboard", "Dashboard", /^#\/dashboard/.test(h)) : ""}${u && u.role === "admin" ? L("#/admin", "Admin Panel", /^#\/admin/.test(h)) : ""}</nav>
    <div class="navright">${u ? `<span>${ico("person-circle")} ${esc(u.fullName)} ${u.role === "admin" ? '<span class="badge amber">Admin</span>' : ""}</span><button class="btn light sm" onclick="A.logout()">Logout</button>` : `<a class="btn light sm" href="#/login">Login</a><a class="btn gold sm" href="#/register">Register</a>`}</div></div>`;

  $("#foot").innerHTML = `<div class="wrap flex between wrapf gap2"><div><strong style="color:#fff">${phx(24)} Phoenix Hub</strong><div class="small">Rise from the ashes. Revive abandoned projects together.</div></div>
    <div class="small right"><a href="#/explore">Explore</a> &middot; <a href="#/share">Share a project</a> &middot; <a href="#/${u ? "dashboard" : "login"}">${u ? "Dashboard" : "Login"}</a><div>&copy; ${new Date().getFullYear()} Phoenix Hub</div></div></div>`;
}

function pcard(p) {
  const z = Store.zip(p.id),
    img = safeUrl(p.imageUrl) ? `<img src="${esc(p.imageUrl)}" alt="" onerror="this.remove()">` : "";

  return `<article class="card pcard"><div class="thumb">${ico(CAT_ICON[p.category] || "box")}${img}</div><div class="pbody">
    <div class="flex between">${statusBadge(p.status)}${z && z.allowDownload ? `<span class="tiny muted" title="ZIP download available">${ico("file-earmark-zip")} ZIP</span>` : ""}</div>
    <h5>${esc(p.name)}</h5><div class="tiny muted mb">by ${esc(p.ownerName)} &middot; ${esc(p.category)}</div><p class="clamp muted">${esc(p.description)}</p>
    <div class="mb">${p.technologies.slice(0, 4).map(t => `<span class="tech">${esc(t)}</span>`).join("")}</div><a class="btn ghost sm" style="margin-top:auto" href="#/project/${encodeURIComponent(p.id)}">View project</a></div></article>`;
}

const dlCount = pid => Store.logs().filter(l => l.type === "download" && l.projectId === pid).length;

/* zip manager (owner): used on project page and dashboard */
function zipManager(p) {
  const z = Store.zip(p.id);

  return `<div class="card pad" style="border-left:4px solid var(--brass)"><h5>${ico("file-earmark-zip")} Project files (owner only)</h5>
    ${z ? `<div class="zipbox mb">${ico("file-earmark-zip")}<div class="grow"><b>${esc(z.name)}</b><span class="tiny muted">${ZipStore.size(z.size)} &middot; uploaded ${fdate(z.uploadedAt)} &middot; ${dlCount(p.id)} download(s)</span></div><button class="btn plain sm" onclick="A.scanZip('${p.id}')">${ico("shield-check")} Scan</button> <button class="btn plain sm" onclick="A.dropZip('${p.id}')">Remove</button></div>
      <label class="switch mb"><input type="checkbox" ${z.allowDownload ? "checked" : ""} onchange="A.allowZip('${p.id}',this.checked)"> Let other people download this zip</label>`
      : `<p class="small muted">Upload a .zip of your project (max 5 MB). You decide whether others can download it.</p>`}
    <label class="label small" for="zin-${p.id}">${z ? "Replace zip file" : "Choose zip file"}</label>
    <input class="input" type="file" id="zin-${p.id}" accept=".zip,application/zip" onchange="A.uploadZip('${p.id}',this)"></div>`;
}

/* ===================== routes ===================== */
function vHome() {
  const all = Store.projects(),
    newest = all.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return [`<section class="hero"><div class="wrap herogrid"><div><h1>Revive Abandoned Projects. Build Something Great.</h1>
    <p class="lead">Phoenix Hub helps developers rediscover, restore, and rebuild abandoned projects together.</p>
    <a class="btn primary lg" href="#/explore">Explore Projects</a> <a class="btn light lg" href="#how">Learn more</a>
    <div class="stats3"><div><b>${all.length}</b><span>Projects shared</span></div><div><b>${all.filter(p => p.status === "Looking for Contributors").length}</b><span>Need contributors</span></div><div><b>${all.filter(p => p.status === "Completed").length}</b><span>Completed</span></div></div></div>
    <div class="cta"><span class="emblem">${phx(84)}</span><h4 class="center">Have an unfinished project?</h4><ul>
      <li>${ico("check-circle")} Describe what works and what is missing</li><li>${ico("check-circle")} Upload your project as a ZIP file</li><li>${ico("check-circle")} Choose who is allowed to download it</li><li>${ico("check-circle")} Approve developers who want to help</li></ul>
      <a class="btn primary block" href="#/share">Share your project</a></div></div></section>
    <section class="section" id="how"><div class="wrap"><h2 class="center mb">How Phoenix Hub works</h2><div class="grid c3">
      <div class="card feature"><div class="ic">${ico("search")}</div><h5>Discover</h5><p class="muted mb0">Search unfinished projects by category, technology and status.</p></div>
      <div class="card feature"><div class="ic">${ico("people")}</div><h5>Collaborate</h5><p class="muted mb0">Send a contribution request. Once the owner accepts, you join the team.</p></div>
      <div class="card feature"><div class="ic">${ico("fire")}</div><h5>Revive</h5><p class="muted mb0">Finish the work together and turn a forgotten project into a completed one.</p></div></div></div></section>
    ${phoenixSection()}
    <section class="band"><div class="wrap flex between wrapf gap2"><div style="max-width:640px"><h2>Share the files. Keep control.</h2><p>Upload your project as a ZIP. Other developers can download it only when you switch downloads on, and you can turn it off at any time.</p></div><a class="btn gold lg" href="#/share">${ico("file-earmark-zip")} Upload a project</a></div></section>
    <section class="section alt"><div class="wrap"><div class="flex between mb"><h2 class="mb0">Recently added projects</h2><a href="#/explore">View all</a></div>
      <div class="grid c3">${newest.length ? newest.map(pcard).join("") : empty("inbox", "No projects shared yet", "Be the first to share an unfinished project.")}</div></div></section>`, null];
}

const F = { q: "", cat: "", status: "", tech: "", sort: "new" };

function vExplore() {
  const techs = [...new Set(Store.projects().flatMap(p => p.technologies))].sort(),
    opt = (arr, v) => arr.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");

  return [`<div class="pagehead"><div class="wrap"><h2>Explore Projects</h2><p class="muted">Find an unfinished project you would like to help complete.</p></div></div>
    <div class="wrap section" style="padding-top:2rem"><div class="filters"><aside class="card pad"><div class="field"><label class="label" for="fq">Search</label><input class="input" id="fq" type="search" placeholder="Name, description or technology" value="${esc(F.q)}" oninput="A.filter()"></div>
    <div class="field"><label class="label" for="fc">Category</label><select class="select" id="fc" onchange="A.filter()"><option value="">All categories</option>${opt(CATEGORIES, F.cat)}</select></div>
    <div class="field"><label class="label" for="fs">Status</label><select class="select" id="fs" onchange="A.filter()"><option value="">All statuses</option>${opt(STATUSES, F.status)}</select></div>
    <div class="field"><label class="label" for="ft">Technology</label><select class="select" id="ft" onchange="A.filter()"><option value="">All technologies</option>${opt(techs, F.tech)}</select></div>
    <div class="field"><label class="label" for="fo">Sort by</label><select class="select" id="fo" onchange="A.filter()"><option value="new" ${F.sort === "new" ? "selected" : ""}>Newest first</option><option value="team" ${F.sort === "team" ? "selected" : ""}>Most contributors</option><option value="az" ${F.sort === "az" ? "selected" : ""}>Name A-Z</option></select></div>
    <button class="btn ghost sm" onclick="A.clearFilters()">Clear filters</button></aside><section><p class="small muted" id="count"></p><div class="grid c3" id="results"></div></section></div></div>`, drawResults];
}

function drawResults() {
  const all = Store.projects(),
    q = F.q.toLowerCase();

  const list = all
    .filter(p =>
      (!q || (p.name + " " + p.description + " " + p.technologies.join(" ")).toLowerCase().includes(q)) &&
      (!F.cat || p.category === F.cat) &&
      (!F.status || p.status === F.status) &&
      (!F.tech || p.technologies.includes(F.tech)))
    .sort((a, b) => F.sort === "az"
      ? a.name.localeCompare(b.name)
      : F.sort === "team"
        ? (b.contributorCount || 0) - (a.contributorCount || 0)
        : b.createdAt.localeCompare(a.createdAt));

  $("#count").textContent = all.length ? `${list.length} project${list.length === 1 ? "" : "s"} found` : "";

  $("#results").innerHTML = !all.length
    ? `<div style="grid-column:1/-1">${empty("inbox", "No projects shared yet", "Projects will appear here once someone shares one.", '<a class="btn primary" href="#/share">Share a project</a>')}</div>`
    : !list.length
      ? `<div style="grid-column:1/-1">${empty("search", "No projects match your filters", "Try a different keyword or clear the filters.")}</div>`
      : list.map(pcard).join("");
}

function vProject(id) {
  const p = Store.project(decodeURIComponent(id));

  if (!p) {
    return [`<div class="wrap section">${empty("question-circle", "Project not found", "This project may have been removed.", '<a class="btn primary" href="#/explore">Browse projects</a>')}</div>`, null];
  }

  const u = Auth.current(),
    z = Store.zip(p.id),
    owner = u && u.id === p.ownerId,
    req = u && Store.contribution(u.id, p.id),
    marked = u && Store.isBookmarked(u.id, p.id);

  const img = safeUrl(p.imageUrl) ? `<img src="${esc(p.imageUrl)}" alt="" onerror="this.remove()">` : "";

  const login = `<a class="btn ghost block mb" href="#/login" onclick="sessionStorage.setItem('phx_next','#/project/${p.id}')">`;

  const contribute = !u
    ? `${login.replace("ghost", "primary")}Login to contribute</a>`
    : owner
      ? `<div class="hint mb" style="margin-top:0">This is your project. <a href="#/edit/${p.id}">Edit</a> &middot; <a href="#/dashboard">Dashboard</a></div>`
      : req
        ? `<button class="btn plain block mb" disabled>Request ${esc(req.status)}</button>`
        : `<button class="btn primary block mb" onclick="A.contribute('${p.id}')">${ico("hand-thumbs-up")} Contribute</button>`;

  const bookmark = u
    ? `<button class="btn ghost block mb" onclick="A.bookmark('${p.id}')">${ico(marked ? "bookmark-fill" : "bookmark")} ${marked ? "Bookmarked" : "Bookmark"}</button>`
    : `${login}${ico("bookmark")} Login to bookmark</a>`;

  const gh = safeUrl(p.githubUrl)
    ? `<a class="btn ghost block mb" href="${esc(p.githubUrl)}" target="_blank" rel="noopener">${ico("github")} View GitHub</a>`
    : "";

  const dreq = u && !owner ? Store.downloadRequest(u.id, p.id) : null,
    approved = !!(dreq && dreq.status === "accepted");

  const dlReq = !u
    ? `${login}Login to request download</a>`
    : dreq
      ? `<button class="btn plain block" disabled>Download request ${esc(dreq.status)}</button>`
      : `<button class="btn primary block" onclick="A.requestDownload('${p.id}')">${ico("download")} Request Download</button>`;

  let dl;
  if (z) {
    dl = (owner || z.allowDownload || approved)
      ? (u
        ? `<button class="btn primary block" onclick="A.download('${p.id}')">${ico("file-earmark-zip")} Download ZIP (${ZipStore.size(z.size)})</button>`
        : `${login}Login to download</a>`)
      : dlReq;
  } else if (!safeUrl(p.downloadUrl)) {
    dl = `<button class="btn plain block" disabled>No download available</button>`;
  } else if (!owner && !p.allowDownload && !approved) {
    dl = dlReq;
  } else if (!u) {
    dl = `${login}Login to download</a>`;
  } else {
    dl = `<a class="btn ghost block" href="${esc(p.downloadUrl)}" target="_blank" rel="noopener">${ico("download")} Download Project</a>`;
  }

  const row = (a, b) => `<li><span class="muted">${a}</span><span>${b}</span></li>`;

  return [`<div class="wrap section" style="padding-top:2rem"><div class="crumbs"><a href="#/explore">Explore Projects</a> / ${esc(p.name)}</div><div class="split"><div>
    <div class="thumb big mb">${ico(CAT_ICON[p.category] || "box")}${img}</div><div class="flex between wrapf"><h2 class="mb0">${esc(p.name)}</h2>${statusBadge(p.status)}</div><p class="muted">by ${esc(p.ownerName)}</p>
    ${journey(p)}<div class="card pad mb"><h5>About this project</h5><p class="mb0" style="white-space:pre-line">${esc(p.description)}</p></div><div class="card pad ${owner || z ? "mb" : ""}"><h5>Technologies</h5>${p.technologies.map(t => `<span class="tech">${esc(t)}</span>`).join("")}</div>${previewCard(p, z, u, owner, approved)}${owner ? zipManager(p) : ""}</div>
    <aside><div class="card pad mb">${contribute}${bookmark}${gh}${dl}</div><ul class="card list">${row("Owner", esc(p.ownerName))}${row("Category", esc(p.category))}${row("Contributors", p.contributorCount || 0)}${row("Created", fdate(p.createdAt))}${row("Last updated", fdate(p.updatedAt))}</ul></aside></div></div>`, () => Preview.init(p.id)];
}

function vLogin() {
  if (Auth.current()) {
    go(Auth.current().role === "admin" ? "#/admin" : "#/dashboard");
    return ["", null];
  }

  return [`<div class="authbg"><div class="wrap"><div class="authcard"><span class="emblem">${phx(76)}</span><h3 class="center mb0">Welcome back</h3><p class="center muted">Log in to your Phoenix Hub account</p><div id="msg"></div>
    <form onsubmit="A.doLogin(event)" novalidate>${fld("email", "Email", "email", 'autocomplete="username"')}${fld("password", "Password", "password", 'autocomplete="current-password"')}
    <label class="check mb"><input type="checkbox" id="remember"> Remember me</label><button class="btn primary block mb" type="submit">Login</button><a class="btn ghost block" href="#/register">Create an account</a></form>
    </div></div></div>`, null];
}

function vRegister() {
  if (Auth.current()) {
    go("#/dashboard");
    return ["", null];
  }

  return [`<div class="authbg"><div class="wrap"><div class="authcard"><span class="emblem">${phx(76)}</span><h3 class="center mb0">Create your account</h3><p class="center muted">Join Phoenix Hub and revive a project</p><div id="msg"></div>
    <form onsubmit="A.doRegister(event)" novalidate>${fld("fullName", "Full Name")}${fld("username", "Username", "text", 'autocomplete="username"')}${fld("email", "Email", "email")}
    ${fld("password", "Password", "password", 'autocomplete="new-password"', "At least 8 characters with an uppercase letter, a lowercase letter and a number.")}${fld("confirm", "Confirm Password", "password", 'autocomplete="new-password"')}
    <button class="btn primary block mb" type="submit">Register</button><p class="center small mb0">Already have an account? <a href="#/login">Login</a></p></form></div></div></div>`, null];
}

function vShare(editId) {
  const u = Auth.current();
  if (!u) return needLogin();

  const p = editId ? Store.project(decodeURIComponent(editId)) : null;

  if (editId && (!p || (p.ownerId !== u.id && u.role !== "admin"))) {
    return [`<div class="wrap section">${empty("shield-x", "Not allowed", "You can only edit your own projects.", '<a class="btn primary" href="#/dashboard">Dashboard</a>')}</div>`, null];
  }

  const v = p || {
    name: "",
    description: "",
    category: CATEGORIES[0],
    status: STATUSES[0],
    technologies: [],
    githubUrl: "",
    imageUrl: "",
    downloadUrl: "",
    allowDownload: false
  };

  const z = p && Store.zip(p.id),
    opt = (a, s) => a.map(x => `<option ${x === s ? "selected" : ""}>${esc(x)}</option>`).join("");

  return [`<div class="pagehead"><div class="wrap"><h2>${p ? "Edit project" : "Share a project"}</h2><p class="muted">Tell developers what you built and what is left to finish.</p></div></div>
    <div class="wrap section" style="padding-top:2rem"><div class="split"><form class="card pad" onsubmit="A.saveProject(event,'${p ? p.id : ""}')" novalidate>
    ${fld("name", "Project Name", "text", `maxlength="100" value="${esc(v.name)}"`)}
    <div class="field"><label class="label" for="description">Description</label><textarea class="textarea" id="description" rows="6" maxlength="3000" placeholder="What does the project do? What is finished, and what is left to do?">${esc(v.description)}</textarea><div class="err" id="e-description"></div></div>
    <div class="grid c2" style="gap:1rem"><div class="field"><label class="label" for="category">Category</label><select class="select" id="category">${opt(CATEGORIES, v.category)}</select></div><div class="field"><label class="label" for="status">Project Status</label><select class="select" id="status">${opt(STATUSES, v.status)}</select></div></div>
    ${fld("technologies", "Technologies Used", "text", `placeholder="e.g. HTML, JavaScript, C#" value="${esc(v.technologies.join(", "))}"`, "Separate technologies with commas.")}
    ${fld("githubUrl", 'GitHub URL <span class="muted">(optional)</span>', "url", `placeholder="https://github.com/username/project" value="${esc(v.githubUrl)}"`)}
    ${fld("imageUrl", 'Project Image Link <span class="muted">(optional)</span>', "url", `placeholder="https://..." value="${esc(v.imageUrl)}"`)}
    ${fld("downloadUrl", 'Project Download Link <span class="muted">(optional)</span>', "url", `placeholder="Google Drive, GitHub release or other link" value="${esc(v.downloadUrl)}"`)}
    <div class="dropzone field"><label class="label" for="zipFile">${ico("file-earmark-zip")} ${z ? "Replace project ZIP" : "Upload project ZIP"} <span class="muted">(optional)</span></label><input class="input" type="file" id="zipFile" accept=".zip,application/zip">
      <div class="help">${z ? `Current file: ${esc(z.name)} (${ZipStore.size(z.size)}). ` : ""}A .zip of your project, up to 5 MB. Only people you allow below can download it.</div><div class="err" id="e-zipFile"></div></div>
    <label class="check mb"><input type="checkbox" id="allowDownload" ${(z ? z.allowDownload : v.allowDownload) ? "checked" : ""}> Allow other users to download this project's files</label>
    <div id="msg"></div><button class="btn primary" type="submit" id="saveBtn">${p ? "Save changes" : "Publish Project"}</button> <a class="btn plain" href="#/${p ? "project/" + p.id : "dashboard"}">Cancel</a></form>
    <aside class="card pad"><h5>Tips for a good listing</h5><ul class="small muted" style="padding-left:1.1rem;margin:0"><li>Be honest about the current state of the project.</li><li>List what is finished and what still needs work.</li><li>Mention how to run the project.</li><li>Choose "Looking for Contributors" if you want help.</li></ul></aside></div></div>`, null];
}

function vDashboard(tab = "mine") {
  const u = Auth.current();
  if (!u) return needLogin();

  const mine = Store.projects().filter(p => p.ownerId === u.id),
    inc = Store.requests().filter(r => r.ownerId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    out = Store.requests().filter(r => r.userId === u.id),
    marks = Store.bookmarked(u.id);

  const dls = Store.logs().filter(l => l.type === "download" && l.ownerId === u.id).length;

  const stat = (n, l, i) => `<div class="card stat"><small>${ico(i)} ${l}</small><b>${n}</b></div>`;

  const T = [
    ["mine", "My projects", mine.length],
    ["in", "Requests received", inc.length],
    ["out", "My requests", out.length],
    ["marks", "Bookmarks", marks.length]
  ];

  const badge = s => `<span class="badge ${s === "accepted" ? "green" : s === "rejected" ? "gray" : "amber"}">${esc(s)}</span>`;

  let body;

  if (tab === "mine") {
    body = !mine.length
      ? empty("folder-plus", "You have not shared a project yet", "Share an unfinished project to find contributors.", '<a class="btn primary" href="#/share">Share a project</a>')
      : mine.map(p => `<div class="card pad mb"><div class="flex between wrapf"><div><h5 class="mb0"><a href="#/project/${p.id}">${esc(p.name)}</a></h5><span class="tiny muted">${esc(p.category)} &middot; ${p.contributorCount || 0} team member(s) &middot; ${dlCount(p.id)} download(s)</span></div>
      <div class="flex"><select class="select" style="width:auto" onchange="A.setStatus('${p.id}',this.value)">${STATUSES.map(s => `<option ${s === p.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select><a class="btn plain sm" href="#/edit/${p.id}">${ico("pencil")} Edit</a><button class="btn danger sm" onclick="A.delProject('${p.id}')">${ico("trash")}</button></div></div><div class="mt">${zipManager(p)}</div></div>`).join("");
  } else if (tab === "in") {
    body = !inc.length
      ? empty("inbox", "No requests yet", "When someone asks to contribute or download, you will see it here.")
      : inc.map(r => `<div class="card pad mb"><div class="flex between wrapf"><div><strong>${esc(r.userName)}</strong> <span class="muted small">(${esc(r.userEmail)})</span> ${r.type === "download" ? "wants to download" : "wants to help with"} <a href="#/project/${r.projectId}">${esc(r.projectName)}</a><div class="tiny muted">${fdt(r.createdAt)}</div></div>
      <div>${r.status === "pending" ? `<button class="btn primary sm" onclick="A.answer('${r.id}','accepted')">Accept</button> <button class="btn plain sm" onclick="A.answer('${r.id}','rejected')">Reject</button>` : badge(r.status)}</div></div><p class="mb0 mt" style="white-space:pre-line">${esc(r.message)}</p></div>`).join("");
  } else if (tab === "out") {
    body = !out.length
      ? empty("send", "You have not sent any requests", "Find a project and press Contribute.", '<a class="btn primary" href="#/explore">Explore projects</a>')
      : `<div class="card tw"><table class="table"><thead><tr><th>Project</th><th>Type</th><th>Sent</th><th>Status</th><th>Decided by</th></tr></thead><tbody>${out.map(r => `<tr><td><a href="#/project/${r.projectId}">${esc(r.projectName)}</a></td><td>${r.type === "download" ? "Download" : "Contribute"}</td><td>${fdate(r.createdAt)}</td><td>${badge(r.status)}</td><td>${r.decidedByName ? esc(r.decidedByName) + " (owner)" : "-"}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    body = marks.length
      ? `<div class="grid c3">${marks.map(pcard).join("")}</div>`
      : empty("bookmark", "No bookmarks", "Bookmark projects you want to come back to.");
  }

  return [`<div class="pagehead"><div class="wrap flex between wrapf"><div><h2>Welcome, ${esc(u.fullName)}</h2><p class="muted">Manage your projects, requests and bookmarks.</p></div><a class="btn primary" href="#/share">${ico("plus-lg")} Share a project</a></div></div>
    <div class="wrap section" style="padding-top:1.8rem"><div class="grid c4 mb">${stat(mine.length, "My projects", "folder2-open")}${stat(inc.filter(r => r.status === "pending").length, "Pending requests", "inbox")}${stat(mine.filter(p => Store.zip(p.id)).length, "ZIP files uploaded", "file-earmark-zip")}${stat(dls, "Downloads of my files", "download")}</div>
    <div class="tabs">${T.map(t => `<a href="#/dashboard/${t[0]}" class="${tab === t[0] ? "on" : ""}">${t[1]}<span class="badge">${t[2]}</span></a>`).join("")}</div>${body}</div>`, null];
}

/* ===================== admin panel ===================== */
const AS = {};
let ADM = null;

function vAdmin(sub = "overview") {
  const u = Auth.current();
  if (!u) return needLogin();

  if (u.role !== "admin") {
    return [`<div class="wrap section">${empty("shield-x", "Admins only", "You need an administrator account to see this page.", '<a class="btn primary" href="#/dashboard">Go to dashboard</a>')}</div>`, null];
  }

  const users = Store.users(),
    projects = Store.projects(),
    logs = Store.logs(),
    reqs = Store.requests(),
    zips = Object.values(Store.zips());

  const uname = id => (users.find(x => x.id === id) || {}).fullName || "-",
    uemail = id => (users.find(x => x.id === id) || {}).email || "-",
    pname = id => (projects.find(x => x.id === id) || {}).name || "(deleted)";

  const downloads = logs.filter(l => l.type === "download"),
    pending = reqs.filter(r => r.status === "pending").length;

  const NAV = [
    ["overview", "Overview", "speedometer2"],
    ["downloads", "Downloads", "download", downloads.length],
    ["uploads", "Uploads", "cloud-arrow-up", zips.length],
    ["projects", "Projects", "folder2-open", projects.length],
    ["users", "Users", "people", users.length],
    ["requests", "Requests", "inbox", pending || ""],
    ["activity", "Activity log", "journal-text", logs.length],
    ["settings", "Settings", "gear"]
  ];

  const bd = s => `<span class="badge ${s === "Yes" || s === "accepted" ? "green" : s === "No" || s === "rejected" ? "gray" : s === "pending" ? "amber" : s === "admin" ? "navy" : ""}">${esc(s)}</span>`;

  const B = (cls, ic, tip, fn) => `<button class="btn ${cls} sm" title="${tip}" onclick="${fn}">${ico(ic)}</button>`;

  const D = {
    downloads: {
      title: "Downloads",
      sub: "Every time someone downloaded a project zip.",
      heads: ["When", "Downloaded by", "Email", "Project", "Owner", "File"],
      rows: downloads.map(l => [fdt(l.at), l.userName, l.userEmail, l.projectName, uname(l.ownerId), l.text.replace("Downloaded ", "")])
    },

    uploads: {
      title: "Uploads",
      sub: "Project zip files that were uploaded.",
      heads: ["Uploaded", "Uploaded by", "Email", "Project", "File", "Size", "Downloads allowed", "Times downloaded"],
      rows: zips.map(z => [fdt(z.uploadedAt), uname(z.uploadedBy), uemail(z.uploadedBy), pname(z.projectId), z.name, ZipStore.size(z.size), z.allowDownload ? "Yes" : "No", dlCount(z.projectId)]),
      badges: { 6: 1 },
      actions: i => {
        const z = zips[i];
        return `<a class="btn plain sm" href="#/project/${z.projectId}">View</a> ${B("plain", "download", "Download zip", `A.download('${z.projectId}')`)} ${B("plain", z.allowDownload ? "lock" : "unlock", z.allowDownload ? "Turn downloads off" : "Turn downloads on", `A.adminAllow('${z.projectId}',${!z.allowDownload})`)} ${B("danger", "trash", "Remove zip", `A.adminDropZip('${z.projectId}')`)}`;
      }
    },

    projects: {
      title: "Projects",
      sub: "All projects shared on the site.",
      heads: ["Project", "Owner", "Category", "Status", "ZIP", "Downloads allowed", "Team", "Created"],
      rows: projects.map(p => {
        const z = Store.zip(p.id);
        return [p.name, p.ownerName, p.category, p.status, z ? z.name : "-", z ? (z.allowDownload ? "Yes" : "No") : "-", p.contributorCount || 0, fdate(p.createdAt)];
      }),
      badges: { 5: 1 },
      actions: i => {
        const p = projects[i],
          z = Store.zip(p.id);
        return `<a class="btn plain sm" href="#/project/${p.id}">View</a>${z ? " " + B("plain", "download", "Download zip", `A.download('${p.id}')`) : ""} ${B("danger", "trash", "Delete project", `A.adminDelProject('${p.id}')`)}`;
      }
    },

    users: {
      title: "Users",
      sub: "Everyone who registered.",
      heads: ["Name", "Username", "Email", "Role", "Joined", "Last login", "Projects", "Downloads made"],
      rows: users.map(x => [x.fullName, x.username, x.email, x.role, fdate(x.createdAt), x.lastLoginAt ? fdt(x.lastLoginAt) : "never", projects.filter(p => p.ownerId === x.id).length, downloads.filter(l => l.userId === x.id).length]),
      badges: { 3: 1 },
      actions: i => {
        const x = users[i];
        if (x.id === u.id) return '<span class="tiny muted">You</span>';
        return `${B("plain", x.role === "admin" ? "person-dash" : "person-up", x.role === "admin" ? "Remove admin" : "Make admin", `A.role('${x.id}','${x.role === "admin" ? "user" : "admin"}')`)} ${B("danger", "trash", "Delete user", `A.delUser('${x.id}')`)}`;
      }
    },

    requests: {
      title: "Contribution & download requests",
      sub: "Who asked to contribute or download, and which project owner approved or rejected it.",
      heads: ["Sent", "Type", "Requester", "Email", "Project", "Owner", "Status", "Decision by owner", "Decided on", "Message"],
      rows: reqs.map(r => [
        fdt(r.createdAt),
        (r.type || "contribute") === "download" ? "Download" : "Contribute",
        r.userName,
        r.userEmail,
        r.projectName,
        uname(r.ownerId),
        r.status,
        r.status === "pending" ? "Waiting for owner" : (r.status === "accepted" ? "Approved by " : "Rejected by ") + (r.decidedByName || uname(r.ownerId)) + " (project owner)",
        r.decidedAt ? fdt(r.decidedAt) : "-",
        r.message
      ]),
      badges: { 6: 1 }
    },

    activity: {
      title: "Activity log",
      sub: "Everything that happens on the site, newest first.",
      heads: ["When", "Type", "User", "Project", "Details"],
      rows: logs.map(l => [fdt(l.at), l.type.replace(/_/g, " "), l.userName || "-", l.projectName || "-", l.text])
    }
  };

  let main = "",
    after = null;

  if (sub === "overview") {
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(Date.now() - (13 - i) * 864e5);
      const k = d.toDateString();
      return {
        l: d.getDate(),
        d: logs.filter(x => x.type === "download" && new Date(x.at).toDateString() === k).length,
        u: logs.filter(x => x.type === "upload" && new Date(x.at).toDateString() === k).length
      };
    });

    const mx = Math.max(1, ...days.flatMap(x => [x.d, x.u])),
      top = projects.map(p => ({ p, n: dlCount(p.id) })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 5),
      topMax = top[0] ? top[0].n : 1;

    const st = (n, l, i) => `<div class="card stat"><small>${ico(i)} ${l}</small><b>${n}</b></div>`,
      bytes = zips.reduce((s, z) => s + z.size, 0);

    main = `<h3>Overview</h3><p class="muted mb">A quick look at what is happening on Phoenix Hub.</p>
      <div class="grid c6 mb">${st(users.length, "Users", "people")}${st(projects.length, "Projects", "folder2-open")}${st(zips.length, "ZIP uploads", "file-earmark-zip")}${st(downloads.length, "Downloads", "download")}${st(pending, "Pending requests", "inbox")}${st(ZipStore.size(bytes), "Storage used", "hdd")}</div>
      <div class="grid c2 mb" style="grid-template-columns:minmax(0,3fr) minmax(0,2fr)"><div class="card pad"><div class="flex between wrapf"><h5 class="mb0">Uploads and downloads, last 14 days</h5><div class="legend"><span><i style="background:var(--ember)"></i>Downloads</span><span><i style="background:var(--brass)"></i>Uploads</span></div></div>
        <div class="bars">${days.map(x => `<div class="col"><div class="pair"><i class="d" style="height:${x.d / mx * 100}%" title="${x.d} downloads"></i><i class="u" style="height:${x.u / mx * 100}%" title="${x.u} uploads"></i></div><em>${x.l}</em></div>`).join("")}</div></div>
      <div class="card pad"><h5>Most downloaded projects</h5>${top.length ? top.map(x => `<div class="mb"><div class="flex between small"><a href="#/project/${x.p.id}">${esc(x.p.name)}</a><b>${x.n}</b></div><div class="meter"><i style="width:${x.n / topMax * 100}%"></i></div></div>`).join("") : '<p class="muted small mb0">No downloads yet.</p>'}</div></div>
      <div class="card"><div class="flex between padsm" style="border-bottom:1px solid var(--line)"><h5 class="mb0">Recent activity</h5><a class="small" href="#/admin/activity">View all</a></div>
      ${logs.length ? `<ul class="list">${logs.slice(0, 8).map(l => `<li><span><b>${esc(l.userName || "System")}</b> <span class="muted">${esc(l.text)}${l.projectName ? " &middot; " + esc(l.projectName) : ""}</span></span><span class="tiny muted nowrap">${fdt(l.at)}</span></li>`).join("")}</ul>` : '<p class="muted pad mb0">Nothing yet.</p>'}</div>`;
  } else if (sub === "settings") {
    main = `<h3>Settings</h3><p class="muted mb">Admin account and data tools.</p><div class="grid c2"><form class="card pad" onsubmit="A.changePw(event)" novalidate><h5>Change your password</h5>${fld("oldPw", "Current password", "password")}${fld("newPw", "New password", "password", "", "At least 8 characters with an uppercase letter, a lowercase letter and a number.")}<div class="err" id="e-form"></div><button class="btn primary" type="submit">Update password</button></form>
      <div class="card pad"><h5>Data</h5><p class="small muted">All data lives in Firebase Realtime Database. You can see it in the Firebase console, or export a copy of what this panel shows.</p><button class="btn plain" onclick="A.exportAll()">${ico("filetype-json")} Export all data (JSON)</button></div></div>`;
  } else if (D[sub]) {
    const d = D[sub];
    AS[sub] = AS[sub] || { q: "", page: 1 };
    ADM = { sub, d };

    main = `<div class="flex between wrapf mb"><div><h3 class="mb0">${d.title}</h3><p class="muted mb0">${d.sub}</p></div><button class="btn plain" onclick="A.csv()">${ico("filetype-csv")} Export CSV</button></div>
      <div class="card"><div class="padsm" style="border-bottom:1px solid var(--line)"><input class="input" style="max-width:340px" type="search" placeholder="Search this table" value="${esc(AS[sub].q)}" oninput="A.adminSearch(this.value)"></div><div id="tbl"></div></div>`;

    after = drawAdminTable;
  } else {
    return [`<div class="wrap section">${empty("question-circle", "Page not found", "That admin page does not exist.", '<a class="btn primary" href="#/admin">Back to overview</a>')}</div>`, null];
  }

  return [`<div class="admin"><aside class="side"><h6>Admin</h6>${NAV.map(n => `<a href="#/admin/${n[0]}" class="${sub === n[0] ? "on" : ""}">${ico(n[2])} ${n[1]}${n[3] !== undefined && n[3] !== "" ? `<span class="count">${n[3]}</span>` : ""}</a>`).join("")}</aside><div class="adminmain">${main}</div></div>`, after];
}

function drawAdminTable() {
  const { sub, d } = ADM,
    st = AS[sub],
    q = st.q.toLowerCase(),
    PS = 10;

  const idx = d.rows.map((_, i) => i).filter(i => !q || d.rows[i].join(" ").toLowerCase().includes(q)),
    pages = Math.max(1, Math.ceil(idx.length / PS));

  st.page = Math.min(st.page, pages);

  const slice = idx.slice((st.page - 1) * PS, st.page * PS);

  const cell = (c, j) => d.badges && d.badges[j]
    ? `<span class="badge ${c === "Yes" || c === "accepted" ? "green" : c === "No" || c === "rejected" ? "gray" : c === "pending" ? "amber" : c === "admin" ? "navy" : ""}">${esc(c)}</span>`
    : esc(c);

  $("#tbl").innerHTML = slice.length
    ? `<div class="tw"><table class="table"><thead><tr>${d.heads.map(h => `<th>${h}</th>`).join("")}${d.actions ? "<th></th>" : ""}</tr></thead><tbody>${slice.map(i => `<tr>${d.rows[i].map((c, j) => `<td title="${esc(c)}">${cell(c, j)}</td>`).join("")}${d.actions ? `<td class="nowrap">${d.actions(i)}</td>` : ""}</tr>`).join("")}</tbody></table></div>
    <div class="pager"><span class="muted">${idx.length} record(s)</span><span class="flex"><button class="btn plain sm" ${st.page <= 1 ? "disabled" : ""} onclick="A.adminPage(-1)">${ico("chevron-left")}</button>Page ${st.page} of ${pages}<button class="btn plain sm" ${st.page >= pages ? "disabled" : ""} onclick="A.adminPage(1)">${ico("chevron-right")}</button></span></div>`
    : empty("search", "Nothing here yet", "No records match.");
}

/* ===================== actions (button handlers) ===================== */
const A = {
  burger() {
    $("#nav").classList.toggle("open");
  },

  stage(k) {
    Object.assign(F, { q: "", cat: "", tech: "", sort: "new", status: STAGES[k].status });
    go("#/explore");
  },

  async scanZip(pid) {
    toast("Scanning files...");
    try {
      const r = Scanner.scan(await ZipReader.forProject(pid));
      await modal({
        title: r.items.length ? "Secret scan results" : "Secret scan passed",
        ok: "Close",
        cancel: "",
        body: r.items.length
          ? Scanner.report(r)
          : `<p class="mb0">No secrets were found in ${r.scanned} text file${r.scanned === 1 ? "" : "s"}. The scan looks for common key formats, so it cannot catch everything.</p>`
      });
    } catch (e) {
      toast(e.message, "bad");
    }
  },

  logout() {
    Auth.logout();
    toast("Logged out.");
    go("#/");
  },

  filter() {
    F.q = $("#fq").value;
    F.cat = $("#fc").value;
    F.status = $("#fs").value;
    F.tech = $("#ft").value;
    F.sort = $("#fo").value;
    drawResults();
  },

  clearFilters() {
    Object.assign(F, { q: "", cat: "", status: "", tech: "", sort: "new" });
    route(true);
  },

  demoAdmin() {
    $("#email").value = "admin@phoenixhub.com";
    $("#password").value = "Admin@123";
  },

  async doLogin(e) {
    e.preventDefault();
    const f = e.target;

    if (!check(f, [
      ["email", v => /^\S+@\S+\.\S+$/.test(v), "Enter a valid email address."],
      ["password", v => v.length > 0, "Enter your password."]
    ])) return;

    try {
      const u = await Auth.login($("#email").value.trim(), $("#password").value, $("#remember").checked);
      const n = sessionStorage.getItem("phx_next");
      sessionStorage.removeItem("phx_next");
      toast("Welcome back, " + u.fullName + "!", "ok");
      go(n && !/^#\/(login|register)/.test(n) ? n : u.role === "admin" ? "#/admin" : "#/dashboard");
    } catch (err) {
      $("#msg").innerHTML = `<div class="hint" style="border-color:#e0675a;color:#8f1d17;margin:0 0 1rem">${esc(err.message)}</div>`;
    }
  },

  async doRegister(e) {
    e.preventDefault();
    const f = e.target;

    if (!check(f, [
      ["fullName", v => v.length >= 2, "Enter your full name (at least 2 characters)."],
      ["username", v => /^[A-Za-z0-9_]{3,20}$/.test(v), "3 to 20 characters: letters, numbers or underscore."],
      ["email", v => /^\S+@\S+\.\S+$/.test(v), "Enter a valid email address."],
      ["password", v => /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}/.test(v), "Password does not meet the rules above."],
      ["confirm", v => v === $("#password").value, "Passwords do not match."]
    ])) return;

    try {
      await Auth.register({
        fullName: $("#fullName").value.trim(),
        username: $("#username").value.trim(),
        email: $("#email").value.trim(),
        password: $("#password").value
      });
      toast("Account created. Please log in.", "ok");
      go("#/login");
    } catch (err) {
      $("#msg").innerHTML = `<div class="hint" style="border-color:#e0675a;color:#8f1d17;margin:0 0 1rem">${esc(err.message)}</div>`;
    }
  },

  async saveProject(e, id) {
    e.preventDefault();

    const f = e.target,
      u = Auth.current(),
      file = $("#zipFile").files[0],
      zerr = file ? await ZipStore.validate(file) : null;

    const ok = check(f, [
      ["name", v => v.length >= 3, "Enter a project name (3 to 100 characters)."],
      ["description", v => v.length >= 20, "Write at least 20 characters so contributors understand the project."],
      ["technologies", v => v.split(",").some(t => t.trim()), "Add at least one technology."],
      ["githubUrl", v => !v || safeUrl(v), "Enter a valid link starting with https://"],
      ["imageUrl", v => !v || safeUrl(v), "Enter a valid link starting with https://"],
      ["downloadUrl", v => !v || safeUrl(v), "Enter a valid link starting with https://"]
    ]);

    $("#e-zipFile").textContent = zerr || "";
    if (!ok || zerr) return;

    const data = {
      name: $("#name").value.trim(),
      description: $("#description").value.trim(),
      category: $("#category").value,
      status: $("#status").value,
      technologies: [...new Set($("#technologies").value.split(",").map(t => t.trim()).filter(Boolean))],
      githubUrl: $("#githubUrl").value.trim(),
      imageUrl: $("#imageUrl").value.trim(),
      downloadUrl: $("#downloadUrl").value.trim(),
      allowDownload: $("#allowDownload").checked
    };

    // secret scan before anything is saved
    if (file && !(await Scanner.guard(file))) return;

    $("#saveBtn").disabled = true;

    try {
      let pid = id;

      if (id) {
        await Store.updateProject(id, data);
      } else {
        pid = Store.uid();
        const now = Store.now();
        await Store.addProject({
          id: pid,
          ...data,
          ownerId: u.id,
          ownerName: u.fullName,
          contributorCount: 0,
          createdAt: now,
          updatedAt: now
        }, u);
      }

      if (file) await ZipStore.save(pid, file, data.allowDownload);
      else if (Store.zip(pid) && Store.zip(pid).allowDownload !== data.allowDownload) await ZipStore.setAllow(pid, data.allowDownload);

      toast(id ? "Project updated." : "Project published!", "ok");
      go("#/project/" + pid);
    } catch (err) {
      $("#msg").innerHTML = `<div class="hint" style="border-color:#e0675a;color:#8f1d17;margin:0 0 1rem">${esc(err.message)}</div>`;
      $("#saveBtn").disabled = false;
    }
  },

  async bookmark(id) {
    const u = Auth.current();
    await Store.toggleBookmark(u.id, id);
    route(true);
  },

  async uploadZip(id, input) {
    const f = input.files[0];
    if (!f) return;

    try {
      const bad = await ZipStore.validate(f);
      if (bad) throw new Error(bad);

      if (!(await Scanner.guard(f))) {
        input.value = "";
        return;
      }

      const z = Store.zip(id);
      await ZipStore.save(id, f, z ? z.allowDownload : false);
      toast("Zip uploaded.", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }

    route(true);
  },

  async allowZip(id, on) {
    await ZipStore.setAllow(id, on);
    toast(on ? "Others can now download this zip." : "Downloads turned off.", "ok");
    route(true);
  },

  async dropZip(id) {
    if (await ask("Remove zip file?", "The uploaded file will be deleted.", "Remove", true)) {
      await ZipStore.remove(id);
      toast("Zip removed.");
      route(true);
    }
  },

  async download(id) {
    try {
      await ZipStore.download(id);
      toast("Download started.", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  },

  async setStatus(id, s) {
    await Store.updateProject(id, { status: s });
    toast("Status updated.", "ok");
    route(true);
  },

  async delProject(id) {
    if (await ask("Delete project?", "This removes the project, its requests and its files. This cannot be undone.", "Delete", true)) {
      await Store.deleteProject(id);
      toast("Project deleted.");
      route(true);
    }
  },

  async answer(id, s) {
    try {
      await Store.setRequestStatus(id, s);
      toast("Request " + s + ".", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
    route(true);
  },

  /* admin */
  adminSearch(v) {
    AS[ADM.sub].q = v;
    AS[ADM.sub].page = 1;
    drawAdminTable();
  },

  adminPage(n) {
    AS[ADM.sub].page += n;
    drawAdminTable();
  },

  csv() {
    const q = AS[ADM.sub].q.toLowerCase(),
      rows = ADM.d.rows.filter(r => !q || r.join(" ").toLowerCase().includes(q)),
      x = v => '"' + String(v).replace(/"/g, '""') + '"';

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[ADM.d.heads, ...rows].map(r => r.map(x).join(",")).join("\n")], { type: "text/csv" }));
    a.download = "phoenix-" + ADM.sub + ".csv";
    a.click();
  },

  async adminAllow(id, on) {
    await ZipStore.setAllow(id, on);
    toast(on ? "Downloads turned on." : "Downloads turned off.", "ok");
    route(true);
  },

  async adminDropZip(id) {
    if (await ask("Remove zip file?", "The file will be deleted from the site.", "Remove", true)) {
      await ZipStore.remove(id);
      toast("Zip removed.");
      route(true);
    }
  },

  async adminDelProject(id) {
    if (await ask("Delete project?", "This removes the project, its requests and its files.", "Delete", true)) {
      await Store.deleteProject(id);
      toast("Project deleted.");
      route(true);
    }
  },

  async role(id, role) {
    if (await ask(
      role === "admin" ? "Make administrator?" : "Remove admin rights?",
      role === "admin" ? "This person will be able to see everything in the admin panel." : "This person will become a normal user.",
      "Confirm"
    )) {
      await Store.setRole(id, role);
      toast("Role updated.", "ok");
      route(true);
    }
  },

  async delUser(id) {
    if (await ask("Delete user?", "Their account, projects, requests and bookmarks will be removed.", "Delete", true)) {
      await Store.deleteUser(id);
      toast("User deleted.");
      route(true);
    }
  },

  async changePw(e) {
    e.preventDefault();
    const f = e.target;

    if (!check(f, [
      ["oldPw", v => v.length > 0, "Enter your current password."],
      ["newPw", v => /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}/.test(v), "Password does not meet the rules above."]
    ])) return;

    try {
      await Auth.changePassword(Auth.current().id, $("#oldPw").value, $("#newPw").value);
      f.reset();
      toast("Password updated.", "ok");
    } catch (err) {
      $("#e-form").textContent = err.message;
    }
  },

  exportAll() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: "application/json" }));
    a.download = "phoenix-hub-data.json";
    a.click();
  }
};

/* contribution request */
A.contribute = async function (id) {
  const u = Auth.current(),
    p = Store.project(id);

  let msg = "";

  const sent = await modal({
    title: "Request to contribute",
    body: `<label class="label" for="rm">Tell the owner why you want to help</label><textarea class="textarea" id="rm" maxlength="500" rows="4"></textarea><div class="err" id="rme"></div>`,
    ok: "Send Request",
    onOk: d => {
      const v = $("#rm", d).value.trim();
      if (v.length < 10) {
        $("#rme", d).textContent = "Write a short message (at least 10 characters).";
        return false;
      }
      msg = v;
    }
  });

  if (sent) {
    await Store.requestContribution(u, p, msg);
    toast("Request sent to the owner.", "ok");
    route(true);
  }
};

/* download request */
A.requestDownload = async function (id) {
  const u = Auth.current(),
    p = Store.project(id);

  if (!u || !p) return;

  let msg = "";

  const sent = await modal({
    title: "Request to download",
    body: `<label class="label" for="rm">Tell the owner why you need the project files</label><textarea class="textarea" id="rm" maxlength="500" rows="4"></textarea><div class="err" id="rme"></div>`,
    ok: "Send Request",
    onOk: d => {
      const v = $("#rm", d).value.trim();
      if (v.length < 10) {
        $("#rme", d).textContent = "Write a short message (at least 10 characters).";
        return false;
      }
      msg = v;
    }
  });

  if (sent) {
    await Store.requestDownload(u, p, msg);
    toast("Download request sent to the owner.", "ok");
    route(true);
  }
};

/* ===================== Zip reader (shared by Live preview and Secret scanner) ===================== */
const ZipReader = (() => {
  const SKIP = /(^|\/)(__MACOSX|node_modules|\.git|\.idea|\.vscode)(\/|$)/;
  const TEXT = /\.(html?|css|scss|less|js|mjs|cjs|jsx|ts|tsx|json|md|txt|py|java|kt|c|cpp|h|hpp|cs|php|rb|go|rs|sh|bat|ps1|yml|yaml|xml|svg|ini|cfg|conf|toml|properties|gradle|sql|vue|svelte|dart|swift|csv|env|pem|key)$/i;

  // protects the browser from zip bombs
  const MAX_FILES = 2000,
    MAX_TEXT = 1024 * 1024,
    MAX_TOTAL = 40 * 1024 * 1024;

  const baseName = p => p.slice(p.lastIndexOf("/") + 1);

  const isText = p => TEXT.test(p) || /^(\.env.*|\.npmrc|\.gitignore|Dockerfile|Makefile|README|LICENSE)$/i.test(baseName(p));

  const bytesOf = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // keeps the last opened project so Preview and Scan do not download it twice
  let cache = null;

  async function fromBytes(bytes) {
    if (!window.JSZip) throw new Error("The zip reader did not load. Check your connection and refresh the page.");

    const zip = await JSZip.loadAsync(bytes),
      files = [];

    let total = 0;

    zip.forEach((path, e) => {
      if (!e.dir && !SKIP.test(path) && files.length < MAX_FILES) {
        files.push({ path, name: baseName(path), size: (e._data && e._data.uncompressedSize) || 0 });
      }
    });

    files.sort((a, b) => a.path.localeCompare(b.path));

    for (const f of files) {
      if (!isText(f.path) || f.size > MAX_TEXT || total + f.size > MAX_TOTAL) continue;

      const t = await zip.file(f.path).async("string");
      if (t.length > MAX_TEXT) continue;

      f.text = t;
      total += t.length;
      if (!f.size) f.size = t.length;
    }

    return { zip, files, paths: new Set(files.map(f => f.path)) };
  }

  return {
    baseName,
    fromBytes,

    async fromFile(file) {
      return fromBytes(await file.arrayBuffer());
    },

    async forProject(pid) {
      const z = Store.zip(pid);
      if (!z) throw new Error("This project has no zip file.");

      const stamp = pid + "|" + z.uploadedAt;
      if (cache && cache.stamp === stamp) return cache.data;

      let s;
      try {
        s = await db.ref("zipData/" + pid).get();
      } catch {
        throw new Error("You do not have permission to open this file.");
      }

      if (!s.exists()) throw new Error("The file data is missing.");

      const data = await fromBytes(bytesOf(s.val()));
      cache = { stamp, data };
      return data;
    }
  };
})();

/* ===================== Secret scanner ===================== */
const Scanner = (() => {
  const PLACEHOLDER = /your|example|sample|placeholder|changeme|change_me|dummy|xxxx|\*{3,}|<[^>]+>|todo|insert|enter|replace|process\.env|\$\{/i;

  const mask = v => {
    v = String(v).replace(/\s+/g, " ");
    return v.length <= 10 ? v.slice(0, 2) + "••••" : v.slice(0, 4) + "••••••" + v.slice(-2);
  };

  const RULES = [
    { name: "AWS access key ID", sev: "high", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { name: "Private key", sev: "high", plain: true, re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g },
    { name: "GitHub token", sev: "high", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g },
    { name: "Stripe live secret key", sev: "high", re: /\b[sr]k_live_[0-9a-zA-Z]{20,}\b/g },
    { name: "Slack token", sev: "high", re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g },
    { name: "Slack or Discord webhook", sev: "high", re: /https:\/\/(?:hooks\.slack\.com\/services\/[A-Za-z0-9\/]{20,}|(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]{20,})/g },
    { name: "SendGrid API key", sev: "high", re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
    { name: "AI provider API key", sev: "high", re: /\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{32,}\b/g },
    { name: "Database URL with password", sev: "high", re: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqps?):\/\/[^\s:@\/'"`]+:[^\s@\/'"`]{3,}@[^\s'"`]+/gi },
    { name: "JSON Web Token", sev: "medium", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
    {
      name: "Hard-coded password or secret",
      sev: "medium",
      re: /\b(?<k>password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["'](?<v>[^"'\s<$\{][^"'\n]{5,})["']/gi,
      skipIf: m => PLACEHOLDER.test(m.groups.v),
      fmt: m => `${m.groups.k} = "${mask(m.groups.v)}"`
    },
    {
      name: "Google API key",
      sev: "low",
      re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
      note: "Normal in a Firebase web config. If you use this key for anything else, restrict it in Google Cloud."
    }
  ];

  // [name test, label, severity, note, exceptions]
  const FILES = [
    [/^\.env(\..+)?$/i, "Environment file", "medium", "Environment files usually hold real keys. Remove it, or keep only placeholders.", /\.(example|sample|template|dist|defaults?)$/i],
    [/\.(pem|key)$/i, "Key or certificate file", "medium", "Make sure this is not a private key."],
    [/\.(p12|pfx|jks|keystore)$/i, "Key store file", "high", "Key stores contain private keys."],
    [/^id_(rsa|dsa|ecdsa|ed25519)$/, "SSH private key file", "high"],
    [/(firebase-adminsdk|service[-_]?account).*\.json$/i, "Cloud service-account file", "high", "This gives full access to a cloud project."]
  ];

  const ORDER = { high: 0, medium: 1, low: 2 };

  const lineOf = (text, idx) => {
    let n = 1,
      i = -1;
    while ((i = text.indexOf("\n", i + 1)) !== -1 && i < idx) n++;
    return n;
  };

  function scan({ files }) {
    const items = [];
    let more = 0,
      scanned = 0;

    const add = i => items.length < 100 ? items.push(i) : more++;

    for (const f of files) {
      for (const [re, rule, sev, note, ok] of FILES) {
        if (re.test(f.name) && !(ok && ok.test(f.name))) add({ file: f.path, rule, sev, note });
      }

      if (f.text == null || /\.min\.(js|css)$|^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(f.name)) continue;

      scanned++;
      const seen = new Set();

      for (const r of RULES) {
        for (const m of f.text.matchAll(r.re)) {
          if ((r.skipIf && r.skipIf(m)) || seen.has(m.index)) continue;
          seen.add(m.index);

          add({
            file: f.path,
            line: lineOf(f.text, m.index),
            rule: r.name,
            sev: r.sev,
            note: r.note,
            preview: r.plain ? m[0] : r.fmt ? r.fmt(m) : mask(m[0])
          });
        }
      }

      if (/^\.env/i.test(f.name) && !/\.(example|sample|template|dist)$/i.test(f.name)) {
        f.text.split(/\r?\n/).forEach((ln, i) => {
          const m = ln.match(/^\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/i);
          if (!m) return;

          const v = m[2].replace(/^["']|["']$/g, "");
          if (v && !PLACEHOLDER.test(v)) {
            add({
              file: f.path,
              line: i + 1,
              rule: "Secret value in .env file",
              sev: "high",
              preview: `${m[1]} = ${mask(v)}`
            });
          }
        });
      }
    }

    items.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
    return { items, more, scanned };
  }

  const SEV = { high: ["red", "High"], medium: ["amber", "Medium"], low: ["gray", "Low"] };

  function report(r, max = 14) {
    const rows = r.items.slice(0, max).map(i => `<li><span class="badge ${SEV[i.sev][0]}">${SEV[i.sev][1]}</span><div><b>${esc(i.rule)}</b><div class="tiny muted">${esc(i.file)}${i.line ? ":" + i.line : ""}</div>${i.preview ? `<code class="tiny">${esc(i.preview)}</code>` : ""}${i.note ? `<div class="tiny muted">${esc(i.note)}</div>` : ""}</div></li>`).join("");
    const left = r.items.length + r.more - max;

    return `<ul class="scanlist">${rows}</ul>${left > 0 ? `<p class="tiny muted">and ${left} more not shown.</p>` : ""}`;
  }

  // runs before an upload; resolves true when it is fine to continue
  async function guard(file) {
    let r;
    try {
      r = scan(await ZipReader.fromFile(file));
    } catch (e) {
      return ask("Could not scan for secrets", `This file could not be checked (${e.message}). Upload it anyway?`, "Upload anyway", true);
    }

    const bad = r.items.filter(i => i.sev !== "low"),
      n = bad.length + r.more;

    if (!bad.length) {
      toast(r.items.length ? "Secret scan: only low-risk items found." : "Secret scan passed: no secrets found.", "ok");
      return true;
    }

    return modal({
      title: "Possible secrets found",
      ok: "Upload anyway",
      cancel: "Cancel upload",
      danger: true,
      body: `<p>The scan found ${n} possible secret${n === 1 ? "" : "s"} in this zip. Anyone allowed to download it could read them. Remove them, replace any real key with a new one, then upload again.</p>${report(r)}`
    });
  }

  return { scan, report, guard };
})();

/* ===================== Live code preview ===================== */
const Preview = (() => {
  // S: loaded zips by project, OPEN: projects whose preview is switched on
  const S = {},
    OPEN = {};

  const MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    webm: "video/webm"
  };

  // The preview page may only load inline code, embedded files and a few well-known CDNs. It cannot call any other website.
  const CSP = "default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

  // sandboxed pages have no storage, so give them a temporary in-memory localStorage/sessionStorage
  const SHIM = `(function(){function M(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};["localStorage","sessionStorage"].forEach(function(n){try{Object.defineProperty(window,n,{value:M(),configurable:true})}catch(e){}})})();`;

  const WIDTH = { full: "100%", tablet: "768px", phone: "390px" };

  const ext = p => (p.split(".").pop() || "").toLowerCase();

  const dirOf = p => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";

  const norm = p => {
    const o = [];
    for (const s of p.split("/")) {
      if (!s || s === ".") continue;
      if (s === "..") o.pop();
      else o.push(s);
    }
    return o.join("/");
  };

  const REMOTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

  // which file inside the zip does this link point to?
  function locate(s, dir, href, page) {
    if (!href || REMOTE.test(href.trim())) return null;

    let p = href.trim().split("#")[0].split("?")[0];
    try {
      p = decodeURIComponent(p);
    } catch {}

    const top = page.includes("/") ? page.split("/")[0] : "",
      cand = p.startsWith("/") ? [norm(p), norm(top + "/" + p)] : [norm(dir + "/" + p)];

    return cand.find(c => c && s.paths.has(c)) || null;
  }

  async function dataUri(s, path, ctx) {
    if (ctx.uri.has(path)) return ctx.uri.get(path);

    const f = s.zip.file(path),
      size = (f._data && f._data.uncompressedSize) || 0;

    if (size > 3 * 1024 * 1024) return null;

    const u = `data:${MIME[ext(path)] || "application/octet-stream"};base64,${await f.async("base64")}`;
    ctx.uri.set(path, u);
    return u;
  }

  async function replaceAsync(str, re, fn) {
    const parts = [];
    let last = 0;

    for (const m of str.matchAll(re)) {
      parts.push(str.slice(last, m.index), fn(m));
      last = m.index + m[0].length;
    }

    parts.push(str.slice(last));
    return (await Promise.all(parts)).join("");
  }

  const cssInline = (s, css, dir, ctx, page) => replaceAsync(css, /url\(\s*(['"]?)([^'")]+?)\1\s*\)/g, async m => {
    const p = locate(s, dir, m[2], page),
      u = p && await dataUri(s, p, ctx);
    return u ? `url("${u}")` : m[0];
  });

  // turns one html page of the zip into a single self-contained document (css, js and images inlined)
  async function build(s, page) {
    const ctx = { uri: new Map() },
      dir = dirOf(page),
      later = [];

    const doc = new DOMParser().parseFromString(await s.zip.file(page).async("string"), "text/html");

    for (const e of [...doc.querySelectorAll("style")]) {
      if (/url\(/.test(e.textContent)) e.textContent = await cssInline(s, e.textContent, dir, ctx, page);
    }

    for (const e of [...doc.querySelectorAll("[style*='url(']")]) {
      e.setAttribute("style", await cssInline(s, e.getAttribute("style"), dir, ctx, page));
    }

    for (const l of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
      const p = locate(s, dir, l.getAttribute("href"), page);
      if (!p) continue;

      const st = doc.createElement("style");
      st.textContent = await cssInline(s, await s.zip.file(p).async("string"), dirOf(p), ctx, page);
      l.replaceWith(st);
    }

    for (const e of [...doc.querySelectorAll("script[src]")]) {
      const p = locate(s, dir, e.getAttribute("src"), page);
      if (!p) continue;

      const n = doc.createElement("script");
      if (e.type) n.type = e.type;
      n.textContent = (await s.zip.file(p).async("string")).replace(/<\/script/gi, "<\\/script");

      if (e.hasAttribute("defer") && e.type !== "module") {
        // deferred scripts run after the page body, like in a browser
        later.push(n);
        e.remove();
      } else {
        e.replaceWith(n);
      }
    }

    later.forEach(n => doc.body.append(n));

    for (const e of [...doc.querySelectorAll("img[src],source[src],video[src],audio[src],input[src],link[rel~='icon'][href]")]) {
      const a = e.hasAttribute("src") ? "src" : "href",
        p = locate(s, dir, e.getAttribute(a), page),
        u = p && await dataUri(s, p, ctx);

      if (u) e.setAttribute(a, u);
    }

    doc.head.insertAdjacentHTML("afterbegin", `<meta http-equiv="Content-Security-Policy" content="${CSP}"><script>${SHIM}</script>`);

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  const pagesOf = files => {
    const idx = f => /^index\.html?$/i.test(f.name) ? 0 : 1;

    return files
      .filter(f => /\.html?$/i.test(f.path))
      .sort((a, b) => idx(a) - idx(b) || a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))
      .map(f => f.path);
  };

  const stampOf = pid => {
    const z = Store.zip(pid);
    return z ? z.uploadedAt : "";
  };

  function paint(pid) {
    const s = S[pid],
      body = $("#pvBody");

    if (!s || !body) return;

    const u = Auth.current(),
      mine = u && (u.role === "admin" || (Store.project(pid) || {}).ownerId === u.id),
      bad = s.scan.items.filter(i => i.sev !== "low").length;

    const badge = bad
      ? `<span class="badge amber">${ico("exclamation-triangle")} ${bad} possible secret${bad === 1 ? "" : "s"} in these files</span>${mine ? ` <button class="linkbtn tiny" onclick="A.scanZip('${pid}')">Review</button>` : ""}`
      : `<span class="badge green">${ico("shield-check")} No secrets detected</span>`;

    const T = (k, icon, label) => `<button class="${s.mode === k ? "on" : ""}" onclick="Preview.mode('${pid}','${k}')">${ico(icon)} ${label}</button>`;

    const D = (k, icon, t) => `<button class="btn plain sm ${s.device === k ? "on" : ""}" title="${t}" aria-label="${t}" onclick="Preview.device('${pid}','${k}')">${ico(icon)}</button>`;

    let main;

    if (s.mode === "run") {
      main = !s.pages.length
        ? `<div class="hint" style="margin:0">This zip has no HTML page to run. Open the Code tab to read the files.</div>`
        : `<div class="pvtools">${s.pages.length > 1 ? `<select class="select" aria-label="Page to run" onchange="Preview.page('${pid}',this.value)">${s.pages.map(p => `<option value="${esc(p)}" ${p === s.page ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>` : `<span class="small muted">${esc(s.page)}</span>`}
        <span class="grow"></span>${D("full", "display", "Desktop width")}${D("tablet", "tablet", "Tablet width")}${D("phone", "phone", "Phone width")}
        <button class="btn plain sm" title="Reload" aria-label="Reload" onclick="Preview.reload('${pid}')">${ico("arrow-clockwise")}</button><button class="btn plain sm" title="Full screen" aria-label="Full screen" onclick="Preview.full()">${ico("fullscreen")}</button></div>
        <div class="pvstage"><div class="pvwrap" style="max-width:${WIDTH[s.device]}"><iframe id="pvFrame" sandbox="allow-scripts" title="Live preview"></iframe></div></div>
        <p class="tiny muted mb0" id="pvNote"></p>`;
    } else {
      main = `<div class="pvcode"><ul class="pvfiles" id="pvFiles">${s.files.map((f, i) => `<li><button data-i="${i}" onclick="Preview.open('${pid}',${i})">${ico(f.text == null ? "file-earmark" : "file-earmark-code")} ${esc(f.path)}</button></li>`).join("")}</ul>
        <div style="min-width:0"><div class="pvname" id="pvName"></div><pre class="pvpre"><code id="pvCode"></code></pre></div></div>`;
    }

    body.innerHTML = `<div class="pvtop"><div class="pvtabs">${T("run", "play-fill", "Preview")}${T("code", "code-slash", "Code")}</div><span class="grow"></span>${badge}</div>${main}
      ${s.mode === "run" ? `<p class="tiny muted" style="margin:.5rem 0 0">Runs in a locked sandbox: it cannot reach your account, and it can only load files from the zip plus a few common CDNs. Anything it saves is temporary.</p>` : ""}`;

    if (s.mode === "run") load(pid);
    else showFile(pid);
  }

  async function load(pid) {
    const s = S[pid],
      f = $("#pvFrame"),
      note = $("#pvNote");

    if (!s || !f || !s.pages.length) return;

    try {
      if (!s.built[s.page]) {
        note.textContent = "Building preview...";
        s.built[s.page] = await build(s, s.page);
      }
    } catch (e) {
      if ($("#pvNote")) $("#pvNote").textContent = "Could not build the preview: " + e.message;
      return;
    }

    if ($("#pvFrame") !== f) return;

    note.textContent = "";
    f.removeAttribute("srcdoc");
    f.srcdoc = s.built[s.page];
  }

  function showFile(pid) {
    const s = S[pid],
      f = s && s.files[s.sel],
      code = $("#pvCode");

    if (!f || !code) return;

    document.querySelectorAll("#pvFiles button").forEach(b => b.classList.toggle("on", +b.dataset.i === s.sel));

    $("#pvName").textContent = `${f.path} · ${ZipStore.size(f.size)}`;

    code.textContent = f.text == null
      ? "This file is binary or too large to show here."
      : f.text.length > 200000
        ? f.text.slice(0, 200000) + "\n\n... file cut at 200 KB ..."
        : f.text;
  }

  async function start(pid) {
    OPEN[pid] = true;

    let body = $("#pvBody");
    if (!body) return;

    if (!S[pid] || S[pid].stamp !== stampOf(pid)) {
      body.innerHTML = `<p class="muted mb0">${ico("hourglass-split")} Opening the project files...</p>`;

      try {
        const d = await ZipReader.forProject(pid);

        for (const k in S) {
          if (k !== pid) delete S[k];
        }

        const pages = pagesOf(d.files),
          first = d.files.findIndex(f => f.path === pages[0]);

        S[pid] = {
          ...d,
          stamp: stampOf(pid),
          pages,
          page: pages[0],
          mode: pages.length ? "run" : "code",
          device: "full",
          built: {},
          scan: Scanner.scan(d),
          sel: first >= 0 ? first : Math.max(0, d.files.findIndex(f => f.text != null))
        };
      } catch (e) {
        OPEN[pid] = false;
        body = $("#pvBody");

        if (body) {
          body.innerHTML = `<div class="hint" style="margin:0 0 .8rem;border-color:#e0675a;color:#8f1d17">${esc(e.message)}</div><button class="btn plain sm" onclick="Preview.start('${pid}')">Try again</button>`;
        }
        return;
      }
    }

    paint(pid);
  }

  return {
    build,
    start,
    paint,

    // called after the project page is redrawn
    init(pid) {
      if (OPEN[pid]) start(pid);
    },

    mode(pid, m) {
      S[pid].mode = m;
      paint(pid);
    },

    page(pid, p) {
      S[pid].page = p;
      load(pid);
    },

    device(pid, d) {
      S[pid].device = d;

      const w = $(".pvwrap");
      if (w) w.style.maxWidth = WIDTH[d];

      document.querySelectorAll(".pvtools .btn.on").forEach(b => b.classList.remove("on"));
      paint(pid);
    },

    reload(pid) {
      load(pid);
    },

    full() {
      const f = $("#pvFrame");
      if (f && f.requestFullscreen) f.requestFullscreen();
    },

    open(pid, i) {
      S[pid].sel = i;
      showFile(pid);
    }
  };
})();

function previewCard(p, z, u, owner, approved) {
  if (!z) return "";

  const can = u && (owner || u.role === "admin" || z.allowDownload || approved);

  const inner = !u
    ? `<p class="small muted">Log in to run or read this project's code here.</p><a class="btn primary sm" href="#/login" onclick="sessionStorage.setItem('phx_next','#/project/${p.id}')">Log in</a>`
    : !can
      ? `<p class="small muted mb0">${ico("lock")} The owner has not opened the files yet. Send a download request, and once it is accepted you can preview the code here.</p>`
      : `<p class="small muted">Run this project's page right here, or read its code. It runs in a locked sandbox, so it cannot touch your account.</p><button class="btn primary" onclick="Preview.start('${p.id}')">${ico("play-fill")} Run live preview</button>`;

  return `<div class="card pad ${owner ? "mb" : ""}"><h5>${ico("play-circle")} Live code preview</h5><div id="pvBody">${inner}</div></div>`;
}

/* ===================== Ashes to Phoenix ===================== */
const STAGES = [
  { status: "On Hold", name: "Ashes", icon: "cloud-fog2", text: "Dormant. The work stopped, but the code is still here." },
  { status: "Looking for Contributors", name: "Embers", icon: "stars", text: "Still glowing. The owner is looking for people to help." },
  { status: "In Progress", name: "Flames", icon: "fire", text: "Back to life. A team is building again." },
  { status: "Completed", name: "Phoenix", icon: "feather", text: "Risen. The project is finished." }
];

function journey(p) {
  const i = STAGES.findIndex(s => s.status === p.status),
    cur = STAGES[i] || STAGES[0];

  return `<div class="card pad mb"><h5>${ico("fire")} Revival journey</h5><ol class="journey">${STAGES.map((s, k) => `<li class="${k < i ? "done" : k === i ? "now" : ""}"><span class="dot">${ico(s.icon)}</span><b>${s.name}</b></li>`).join("")}</ol><p class="small muted mb0"><b>${cur.name}.</b> ${esc(cur.text)}</p></div>`;
}

function phoenixSection() {
  const all = Store.projects(),
    n = STAGES.map(s => all.filter(p => p.status === s.status).length),
    pct = all.length ? Math.round(100 * n[3] / all.length) : 0;

  const risen = all
    .filter(p => p.status === "Completed")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 3);

  return `<section class="section alt" id="phoenix"><div class="wrap"><div class="center mb"><span class="badge red">The Phoenix path</span><h2 style="margin-top:.6rem">From ashes to phoenix</h2>
    <p class="muted" style="max-width:56ch;margin-inline:auto">Every project on Phoenix Hub sits somewhere on this path. Pick a stage to see who is there, or find a project to carry forward.</p></div>
    <div class="grid c4 stages">${STAGES.map((s, k) => `<button class="card stage s${k}" onclick="A.stage(${k})"><span class="ic">${ico(s.icon)}</span><b class="n">${n[k]}</b><h5>${s.name}</h5><p class="small muted mb0">${esc(s.text)}</p></button>`).join("")}</div>
    <div class="card pad mt"><div class="flex between small"><span>${ico("graph-up-arrow")} Revival rate</span><b>${pct}%</b></div><div class="meter" role="img" aria-label="${pct} percent of projects have risen"><i style="width:${pct}%"></i></div>
      <p class="tiny muted mb0" style="margin-top:.4rem">${n[3]} of ${all.length} project${all.length === 1 ? " has" : "s have"} risen to Phoenix.</p></div>
    ${risen.length ? `<h4 class="mt">Recently risen</h4><div class="grid c3">${risen.map(pcard).join("")}</div>` : `<p class="center muted mt mb0">No project has risen yet. <a href="#/share">Share one</a> and be the first.</p>`}</div></section>`;
}

/* ===================== router ===================== */
const ROUTES = [
  [/^#?\/?$/, vHome],
  [/^#\/explore$/, vExplore],
  [/^#\/project\/(.+)$/, vProject],
  [/^#\/login$/, vLogin],
  [/^#\/register$/, vRegister],
  [/^#\/share$/, vShare],
  [/^#\/edit\/(.+)$/, vShare],
  [/^#\/dashboard(?:\/(\w+))?$/, vDashboard],
  [/^#\/admin(?:\/(\w+))?$/, vAdmin]
];

let lastBase = "";

async function route(keep) {
  await Store.ready;

  const h = location.hash || "#/",
    y = window.scrollY;

  let hit = null;

  // admin search/page resets when you navigate
  if (keep !== true) {
    for (const k in AS) delete AS[k];
  }

  for (const [re, fn] of ROUTES) {
    const m = h.match(re);
    if (m) {
      hit = [fn, m.slice(1)];
      break;
    }
  }

  if (!hit) {
    hit = [() => [`<div class="wrap section">${empty("compass", "Page not found", "That page does not exist.", '<a class="btn primary" href="#/">Go home</a>')}</div>`, null], []];
  }

  const [html, after] = hit[0](...hit[1]);

  $("#app").innerHTML = html;
  if (after) after();
  renderNav();
  $("#nav").classList.remove("open");

  const base = h.split("/").slice(0, 3).join("/");
  window.scrollTo(0, keep === true && base === lastBase ? y : 0);
  lastBase = base;
}

window.addEventListener("hashchange", () => route());
route();