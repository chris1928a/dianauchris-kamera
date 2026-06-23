# Hochzeits-Kamera, Diana & Chris

Eigener Once-Klon. Gast scannt QR-Code, Kamera oeffnet sich im Browser, macht max 15 Aufnahmen wie eine Wegwerfkamera, alles landet automatisch in unserem eigenen Speicher. Kein App-Download, kein Login fuer die Gaeste.

Live auf `dianauchris.com` (z.B. unter `dianauchris.com/kamera`).

## Was es kann

- Link auf, Kamera oeffnet sofort (mit kurzem Start-Tap, vom Browser erzwungen)
- Live-Kamera im Browser, Auslöser, Front/Back wechseln
- Maximal 15 Aufnahmen pro Geraet (in `config.js` einstellbar)
- Delayed Reveal: Gaeste sehen ihre Bilder nicht, wie eine echte Wegwerfkamera
- Automatischer Upload in unseren Supabase-Speicher, mit Retry bei schlechtem Netz
- Host-Galerie (`gallery.html`) zum Ansehen und Herunterladen aller Fotos
- QR-Generator (`qr.html`) zum Drucken

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` + `app.js` + `styles.css` | Die Gaeste-Kamera |
| `config.js` | Alle Einstellungen (Keys, Namen, Limit) |
| `gallery.html` + `gallery.js` | Host-Galerie, passwortgeschuetzt |
| `qr.html` | QR-Code erzeugen und drucken |
| `supabase-setup.sql` | Speicher einrichten |

## Setup in 4 Schritten

### 1. Supabase-Projekt anlegen (gratis)
1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt erstellen.
2. Im Dashboard unter **SQL Editor** den Inhalt von `supabase-setup.sql` einfuegen und ausfuehren. Das legt den Bucket `wedding-photos` an und erlaubt anonyme Uploads.
3. Unter **Project Settings > API** kopieren:
   - **Project URL** (z.B. `https://abcd1234.supabase.co`)
   - **anon public** Key (NICHT den service_role Key)

### 2. config.js ausfuellen
```js
supabaseUrl: "https://abcd1234.supabase.co",
supabaseAnonKey: "eyJ...dein-anon-key...",
bucket: "wedding-photos",
```
Optional anpassen: `maxShots`, `coupleNames`, `weddingDate`, `galleryPassword`.

### 3. Auf dianauchris.com hochladen
Den ganzen Ordner als statische Dateien auf die Domain legen, z.B. in einen Unterordner `/kamera`. Funktioniert auf jedem Static-Host (Netlify, Vercel, Cloudflare Pages, normaler Webspace).

**Wichtig:** Die Seite MUSS ueber **HTTPS** laufen, sonst gibt der Browser keinen Kamera-Zugriff frei. `dianauchris.com` mit gueltigem Zertifikat ist Pflicht.

### 4. QR-Code erzeugen
`dianauchris.com/kamera/qr.html` oeffnen, Link pruefen, drucken. Auf Tischkarten, Welcome-Schild und am Eingang platzieren.

## Galerie ansehen (nur ihr)
`dianauchris.com/kamera/gallery.html` oeffnen, Passwort aus `config.js` eingeben. Dort alle Fotos sehen, einzeln im neuen Tab oeffnen und speichern. Komplett-Download aller Fotos geht am einfachsten ueber das Supabase Dashboard (Storage > wedding-photos > Download).

## Hinweise

- **Limit pro Geraet, nicht pro Person.** Das 15er-Limit haengt am `localStorage` des Browsers. Ein neugieriger Gast koennte den Browser-Speicher leeren und neu starten. Fuer eine Hochzeit unkritisch.
- **Privatsphaere.** Der Bucket ist oeffentlich lesbar, aber die Dateipfade sind zufaellig und nicht erratbar. Wer den genauen Link nicht hat, sieht nichts. Die Galerie-Liste ist passwortgeschuetzt. Nach der Hochzeit kannst du die SELECT-Policy in Supabase entfernen, dann ist Listen ganz dicht.
- **Kosten.** Supabase Free Tier reicht fuer eine Hochzeit locker (1 GB Storage). Bei ~122 Gaesten x 15 Fotos x ~1,5 MB sind das grob 2,7 GB. Falls es eng wird: `maxEdgePx` auf 2048 und `jpegQuality` auf 0.8 senken, oder einmalig auf den Pro-Plan (8 GB) gehen.
- **Fallback.** Wenn ein Geraet keinen Live-Kamera-Stream erlaubt, oeffnet die App automatisch die normale Foto-App des Handys.

## Lokal testen
Wegen Kamera-Zugriff geht `file://` nicht. Lokal mit einem kleinen Server starten, z.B.:
```bash
cd 05-personal/wedding/photo-app
python3 -m http.server 8000
```
Dann `http://localhost:8000` oeffnen (localhost gilt dem Browser als sicher). Fuer echten Handy-Test brauchst du HTTPS, am besten direkt auf der Domain testen.
