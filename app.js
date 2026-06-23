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
  if (cfg.weddingDate) $("date-sub").textContent = cfg.weddingDate;
  $("max-lede").textContent = MAX;
  $("done-max").textContent = MAX;
  if (guestName) $("guest-name").value = guestName;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("visible"));
    screens[name].classList.add("visible");
  }

  function updateCounter() {
    counterEl.textContent = shotCount + " / " + MAX;
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
      errEl.textContent =
        "Kamera-Zugriff nicht moeglich. Wir oeffnen stattdessen deine Foto-App.";
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
      setStatus("Aufnahme fehlgeschlagen, nochmal probieren.", true);
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
      setStatus("Demo-Modus: Speicher noch nicht konfiguriert.", true);
      return;
    }
    const path = buildPath();
    const url =
      cfg.supabaseUrl.replace(/\/$/, "") +
      "/storage/v1/object/" +
      encodeURIComponent(cfg.bucket) +
      "/" +
      path;

    setStatus("Lade hoch ...");
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
      setStatus("Gespeichert ✓");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      console.error("upload failed", e);
      if (attempt < 3) {
        const wait = attempt * 1500;
        setStatus("Verbindung wackelt, neuer Versuch ...", true);
        setTimeout(() => uploadPhoto(blob, attempt + 1), wait);
      } else {
        setStatus("Upload spaeter erneut. Bleib einfach hier.", true);
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
    $("done-uploaded").textContent = `${n} Aufnahmen gespeichert.`;
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

  updateCounter();
})();
