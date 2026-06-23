// ============================================================
//  Hochzeits-Kamera, Once-Stil
//  Link auf -> Kamera oeffnet -> max N Aufnahmen -> Upload zu Supabase
// ============================================================

(function () {
  "use strict";

  const cfg = window.WEDDING_CONFIG || {};
  const MAX = Number(cfg.maxShots) || 15;
  const QUALITY = Number(cfg.jpegQuality) || 0.9;
  const MAX_EDGE = Number(cfg.maxEdgePx) || 2560;

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const screens = {
    welcome: $("screen-welcome"),
    camera: $("screen-camera"),
    done: $("screen-done"),
  };
  const video = $("video");
  const canvas = $("canvas");
  const flash = $("flash");
  const counterEl = $("cam-counter");
  const lastThumb = $("last-thumb");
  const framesNumEl = $("frames-left-num");
  const shutter = $("btn-shutter");
  const flipBtn = $("btn-flip");
  const statusEl = $("upload-status");
  const fileFallback = $("file-fallback");

  // --- State ---
  const STORE_KEY = "wedding_cam_count_v1";
  const NAME_KEY = "wedding_cam_name_v1";
  let shotCount = Number(localStorage.getItem(STORE_KEY) || 0);
  let guestName = localStorage.getItem(NAME_KEY) || "";
  let stream = null;
  let facing = "environment";
  let busy = false;

  // --- Branding ---
  if (cfg.coupleNames) {
    $("couple-title").textContent = cfg.coupleNames;
    $("cam-couple").textContent = cfg.coupleNames;
  }
  if (guestName) $("guest-name").value = guestName;

  // --- Sprache / Language (Auto-Erkennung + Umschalter) ---
  const STRINGS = {
    de: {
      title: "Diana & Chris, Hochzeitskamera",
      dateText: cfg.weddingDate || "08.08.2026",
      welcome: "Hey, schön dass du dabei bist. Du hast {N} Fotos, um die schönsten Momente unserer Hochzeit festzuhalten. Die Bilder gibt es erst nach dem großen Tag, ganz wie früher bei der Einwegkamera. Wir freuen uns riesig auf das, was du einfängst, danke dir!",
      nameLabel: "Dein Name (optional)",
      namePlaceholder: "z.B. Tante Petra",
      start: "Kamera starten",
      hint: "Gleich fragt dein Handy nach der Kamera, ein Tipp auf Erlauben und es kann losgehen.",
      cameraError: "Kamera-Zugriff nicht möglich. Wir öffnen stattdessen deine Foto-App.",
      counter: "Noch {n}",
      framesLabel: "übrig",
      doneBadge: "FILM VOLL",
      doneTitle: "Danke!",
      done: "Das war's, deine {N} Aufnahmen sind im Kasten und bleiben bis nach der Feier ein Geheimnis. Danke, dass du unseren Tag durch deine Augen festgehalten hast, wir freuen uns riesig auf die Enthüllung.",
      doneCount: "{n} Aufnahmen gespeichert.",
      uploading: "Lade hoch ...",
      saved: "Gespeichert ✓",
      retrying: "Verbindung wackelt, neuer Versuch ...",
      uploadLater: "Upload später erneut. Bleib einfach hier.",
      captureFail: "Aufnahme fehlgeschlagen, nochmal probieren.",
      demoMode: "Demo-Modus: Speicher noch nicht konfiguriert.",
      flipAria: "Kamera wechseln",
      shutterAria: "Foto aufnehmen",
    },
    en: {
      title: "Diana & Chris, Wedding Camera",
      dateText: "August 8, 2026",
      welcome: "Hey, so glad you're here with us. You have {N} photos to capture the loveliest moments of our wedding. You'll see the pictures only after the big day, just like an old-school disposable camera. We can't wait to see what you catch, thank you!",
      nameLabel: "Your name (optional)",
      namePlaceholder: "e.g. Aunt Mary",
      start: "Start camera",
      hint: "In a moment your phone will ask to use the camera, just tap Allow and you're ready to go.",
      cameraError: "Camera access is not available. We'll open your photo app instead.",
      counter: "{n} left",
      framesLabel: "left",
      doneBadge: "FILM FULL",
      doneTitle: "Thank you!",
      done: "That's it, your {N} shots are safely in the can and stay a secret until after the celebration. Thank you for capturing our day through your eyes, we can't wait for the big reveal.",
      doneCount: "{n} shots saved.",
      uploading: "Uploading ...",
      saved: "Saved ✓",
      retrying: "Connection is shaky, trying again ...",
      uploadLater: "We'll upload this again shortly, just stay here.",
      captureFail: "Shot failed, please try again.",
      demoMode: "Demo mode: storage not configured yet.",
      flipAria: "Switch camera",
      shutterAria: "Take photo",
    },
  };

  const LANG_KEY = "wedding_cam_lang_v1";
  let lang = localStorage.getItem(LANG_KEY) ||
    ((navigator.language || "de").toLowerCase().indexOf("de") === 0 ? "de" : "en");
  if (!STRINGS[lang]) lang = "de";
  const t = (k) => (STRINGS[lang] || STRINGS.de)[k];
  let lastDoneCount = null;

  const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };

  function applyLang() {
    const s = STRINGS[lang] || STRINGS.de;
    document.documentElement.lang = lang;
    document.title = s.title;
    setText("date-sub", s.dateText);
    const wl = $("welcome-lede");
    if (wl) wl.innerHTML = s.welcome.replace("{N}", "<strong>" + MAX + "</strong>");
    setText("name-label", s.nameLabel);
    if ($("guest-name")) $("guest-name").placeholder = s.namePlaceholder;
    setText("btn-start", s.start);
    setText("welcome-hint", s.hint);
    setText("frames-left-label", s.framesLabel);
    if (flipBtn) flipBtn.setAttribute("aria-label", s.flipAria);
    if (shutter) shutter.setAttribute("aria-label", s.shutterAria);
    setText("done-badge", s.doneBadge);
    setText("done-title", s.doneTitle);
    const dl = $("done-lede");
    if (dl) dl.innerHTML = s.done.replace("{N}", String(MAX));
    if (lastDoneCount != null) setText("done-uploaded", s.doneCount.replace("{n}", lastDoneCount));
    document.querySelectorAll("#lang-toggle button").forEach((b) =>
      b.classList.toggle("active", b.dataset.lang === lang));
    updateCounter();
  }

  document.querySelectorAll("#lang-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem(LANG_KEY, lang);
      applyLang();
    });
  });

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("visible"));
    screens[name].classList.add("visible");
  }

  function updateCounter() {
    const left = Math.max(0, MAX - shotCount);
    counterEl.textContent = t("counter").replace("{n}", left);
    if (framesNumEl) framesNumEl.textContent = left;
  }

  // ---------- Start ----------
  $("btn-start").addEventListener("click", async () => {
    const errEl = $("welcome-error");
    errEl.classList.add("hidden");

    guestName = ($("guest-name").value || "").trim();
    localStorage.setItem(NAME_KEY, guestName);

    if (shotCount >= MAX) {
      finishFilm();
      return;
    }

    try {
      await startCamera();
      updateCounter();
      showScreen("camera");
    } catch (e) {
      // Kamera-Stream nicht moeglich -> Datei-Fallback (oeffnet System-Kamera)
      console.warn("getUserMedia failed, falling back to file input", e);
      errEl.textContent = t("cameraError");
      errEl.classList.remove("hidden");
      enableFileFallback();
    }
  });

  // ---------- Kamera-Stream ----------
  async function startCamera() {
    stopStream();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  flipBtn.addEventListener("click", async () => {
    facing = facing === "environment" ? "user" : "environment";
    try {
      await startCamera();
    } catch (e) {
      facing = facing === "environment" ? "user" : "environment";
    }
  });

  // ---------- Auslösen ----------
  shutter.addEventListener("click", capture);

  async function capture() {
    if (busy || shotCount >= MAX) return;
    busy = true;
    shutter.disabled = true;

    // Flash-Animation
    flash.classList.remove("fire");
    void flash.offsetWidth;
    flash.classList.add("fire");

    try {
      const blob = await grabFrame();
      shotCount++;
      localStorage.setItem(STORE_KEY, String(shotCount));
      updateCounter();
      showThumb(blob);

      // Upload im Hintergrund, blockiert den naechsten Schuss nicht lange
      uploadPhoto(blob);
    } catch (e) {
      console.error(e);
      setStatus(t("captureFail"), true);
    } finally {
      busy = false;
      if (shotCount >= MAX) {
        finishFilm();
      } else {
        shutter.disabled = false;
      }
    }
  }

  function grabFrame() {
    return new Promise((resolve, reject) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return reject(new Error("no video frame"));

      let w = vw, h = vh;
      const longest = Math.max(w, h);
      if (longest > MAX_EDGE) {
        const scale = MAX_EDGE / longest;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Front-Kamera spiegeln, damit das Bild natuerlich wirkt
      if (facing === "user") {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
        "image/jpeg",
        QUALITY
      );
    });
  }

  function showThumb(blob) {
    if (cfg.delayedReveal) return; // Wegwerfkamera: keine Vorschau
    const fl = $("frames-left");
    if (fl) fl.style.display = "none"; // bei sichtbarer Vorschau kein Zaehler-Badge
    const url = URL.createObjectURL(blob);
    lastThumb.src = url;
    lastThumb.classList.add("show");
    lastThumb.onload = () => URL.revokeObjectURL(url);
  }

  // ---------- Upload ----------
  function sanitize(s) {
    return (s || "gast")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "gast";
  }

  function buildPath() {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).slice(2, 8);
    return `uploads/${sanitize(guestName)}/${ts}-${rand}.jpg`;
  }

  async function uploadPhoto(blob, attempt = 1) {
    if (!cfg.supabaseUrl || cfg.supabaseUrl.includes("DEIN-PROJEKT")) {
      setStatus(t("demoMode"), true);
      return;
    }
    const path = buildPath();
    const url =
      cfg.supabaseUrl.replace(/\/$/, "") +
      "/storage/v1/object/" +
      encodeURIComponent(cfg.bucket) +
      "/" +
      path;

    setStatus(t("uploading"));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: "Bearer " + cfg.supabaseAnonKey,
          "Content-Type": "image/jpeg",
          "x-upsert": "false",
          "cache-control": "3600",
        },
        body: blob,
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()));
      setStatus(t("saved"));
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      console.error("upload failed", e);
      if (attempt < 3) {
        const wait = attempt * 1500;
        setStatus(t("retrying"), true);
        setTimeout(() => uploadPhoto(blob, attempt + 1), wait);
      } else {
        setStatus(t("uploadLater"), true);
        queueRetry(blob);
      }
    }
  }

  // Fehlgeschlagene Uploads sammeln und bei Netz erneut senden
  const retryQueue = [];
  function queueRetry(blob) {
    retryQueue.push(blob);
  }
  window.addEventListener("online", () => {
    while (retryQueue.length) uploadPhoto(retryQueue.shift());
  });

  function setStatus(msg, isError) {
    statusEl.innerHTML = msg ? `<span class="${isError ? "err" : ""}">${msg}</span>` : "";
  }

  // ---------- Film voll ----------
  function finishFilm() {
    stopStream();
    showScreen("done");
    const n = Math.min(shotCount, MAX);
    lastDoneCount = n;
    $("done-uploaded").textContent = t("doneCount").replace("{n}", n);
  }

  // ---------- Datei-Fallback ----------
  function enableFileFallback() {
    showScreen("camera");
    video.style.display = "none";
    shutter.onclick = () => fileFallback.click();
    flipBtn.style.display = "none";
    updateCounter();
    fileFallback.addEventListener("change", async () => {
      const f = fileFallback.files && fileFallback.files[0];
      if (!f) return;
      shotCount++;
      localStorage.setItem(STORE_KEY, String(shotCount));
      updateCounter();
      uploadPhoto(f);
      fileFallback.value = "";
      if (shotCount >= MAX) finishFilm();
    });
  }

  // Stream sauber stoppen, wenn Tab in den Hintergrund geht
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopStream();
    else if (screens.camera.classList.contains("visible") && shotCount < MAX) {
      startCamera().catch(() => {});
    }
  });

  applyLang();
})();
