// ============================================================
//  Host-Galerie: listet alle hochgeladenen Fotos aus dem Bucket
//  Erfordert eine SELECT-Policy auf dem Bucket (siehe supabase-setup.sql).
//  Nach der Hochzeit kannst du die SELECT-Policy wieder entfernen.
// ============================================================

(function () {
  "use strict";
  const cfg = window.WEDDING_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  if (cfg.coupleNames) $("g-title").textContent = cfg.coupleNames;

  const base = (cfg.supabaseUrl || "").replace(/\/$/, "");
  const headers = {
    apikey: cfg.supabaseAnonKey,
    Authorization: "Bearer " + cfg.supabaseAnonKey,
    "Content-Type": "application/json",
  };

  // ---- Passwort-Gate (simple Huerde) ----
  function unlocked() { return sessionStorage.getItem("gallery_ok") === "1"; }

  if (cfg.galleryPassword && !unlocked()) {
    $("gate").classList.remove("hidden");
    $("gate-btn").addEventListener("click", () => {
      if ($("gate-pass").value === cfg.galleryPassword) {
        sessionStorage.setItem("gallery_ok", "1");
        $("gate").classList.add("hidden");
        boot();
      } else {
        $("gate-err").classList.remove("hidden");
      }
    });
  } else {
    boot();
  }

  function boot() {
    $("content").classList.remove("hidden");
    load();
    $("btn-refresh").addEventListener("click", load);
  }

  // Rekursiv alle Objekte unter uploads/ einsammeln
  async function listFolder(prefix) {
    const res = await fetch(
      base + "/storage/v1/object/list/" + encodeURIComponent(cfg.bucket),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          prefix,
          limit: 1000,
          sortBy: { column: "created_at", order: "desc" },
        }),
      }
    );
    if (!res.ok) throw new Error("list failed: " + res.status);
    return res.json();
  }

  async function collectAll(prefix, out) {
    const items = await listFolder(prefix);
    for (const it of items) {
      const isFolder = it.id === null || it.metadata === null;
      if (isFolder) {
        await collectAll(prefix + it.name + "/", out);
      } else {
        out.push(prefix + it.name);
      }
    }
    return out;
  }

  function publicUrl(path) {
    return base + "/storage/v1/object/public/" + encodeURIComponent(cfg.bucket) + "/" + path;
  }

  async function load() {
    const grid = $("grid");
    grid.innerHTML = "";
    $("count").textContent = "Lade ...";
    try {
      const paths = await collectAll("uploads/", []);
      $("count").textContent = paths.length + " Fotos";
      $("empty").classList.toggle("hidden", paths.length > 0);
      for (const p of paths) {
        const url = publicUrl(p);
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = url;
        a.appendChild(img);
        grid.appendChild(a);
      }
    } catch (e) {
      console.error(e);
      $("count").textContent =
        "Fehler beim Laden. Pruefe Supabase-Keys und die SELECT-Policy.";
    }
  }
})();
