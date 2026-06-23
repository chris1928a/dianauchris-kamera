// ============================================================
//  Konfiguration der Hochzeits-Kamera
//  Hier traegst du deine Supabase-Daten und Einstellungen ein.
//  Nach dem Ausfuellen: Datei speichern, fertig. Kein Build noetig.
// ============================================================

window.WEDDING_CONFIG = {
  // --- Paar / Branding ---
  coupleNames: "Diana & Chris",
  weddingDate: "08.08.2026",

  // --- Kamera-Regeln (wie Once) ---
  maxShots: 15,            // maximale Aufnahmen pro Geraet
  jpegQuality: 0.9,        // 0.5 bis 1.0
  maxEdgePx: 2560,         // laengste Bildkante, runterskaliert fuer schnellen Upload

  // Delayed Reveal: Gaeste sehen ihre Bilder NICHT (wie Wegwerfkamera).
  // Auf false setzen, wenn Gaeste ihre eigenen Aufnahmen sehen duerfen.
  delayedReveal: true,

  // --- Supabase Storage ---
  // Projekt: dianauchris-photos (Region EU Frankfurt, Free Tier)
  // supabaseAnonKey ist der oeffentliche anon-Key (role: anon), bewusst committed.
  // service_role-Key gehoert NIEMALS hierher.
  supabaseUrl: "https://ikzjqbpalvpprmwfmurt.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrempxYnBhbHZwcHJtd2ZtdXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODkxNDAsImV4cCI6MjA5Nzc2NTE0MH0.uWDpVg8nU4WT1P0iis6TKdn0iCy_c839Sk98dzyS0JI",
  bucket: "wedding-photos",

  // --- Galerie (gallery.html) ---
  // Einfaches Client-Passwort als simple Huerde. Nicht hochsicher,
  // reicht fuer eine Hochzeit. Leer lassen = kein Passwort.
  galleryPassword: "diana-chris-2026"
};
