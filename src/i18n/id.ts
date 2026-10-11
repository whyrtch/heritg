/** Indonesian (default) copy, matched to heritg.us. Other catalogs may omit keys; they fall back to these. */
export const id = {
  // Shell
  "shell.openTrees": "Lihat kumpulan silsilah",
  "shell.renameTree": "Ubah nama silsilah",
  "shell.renameTreeNamed": "Ubah nama silsilah: {name}",
  "shell.renamePrompt": "Ubah nama silsilah",
  "shell.summary": "{people} orang · {relationships} hubungan",
  "shell.familyPlus": "Heritg Family+",
  "shell.share": "Bagikan",
  "shell.shareTree": "Bagikan silsilah",
  "shell.settings": "Setelan",
  "shell.controls": "Kontrol layar",
  "shell.allPeople": "Semua orang",
  "shell.branchCount": "Jumlah turunan cabang",
  "shell.zoomIn": "Zoom In",
  "shell.zoomOut": "Zoom Out",
  "shell.fit": "Pas ke layar",
  "shell.privacyGroup": "Perlindungan privasi · Bantuan",
  "shell.privacy": "Perlindungan privasi: {state}",
  "shell.privacyProtected": "Dilindungi",
  "shell.help": "Bantuan",
  "shell.hideControls": "Sembunyikan kontrol",
  "shell.showControls": "Tampilkan kontrol",
  "shell.viewMode": "Tampilan pohon",
  "shell.viewModeValue": "Tampilan pohon: {mode}",
  "shell.viewFocus": "Fokus",
  "shell.viewFull": "Lengkap",
  "shell.viewFan": "Kipas",
  "shell.viewFocusLong": "Fokus keluarga",
  "shell.viewFullLong": "Pohon lengkap",
  "shell.viewSoon": "Segera hadir",
  "shell.addMember": "Tambah anggota keluarga",
  "shell.loading": "Lagi buka arsipmu…",

  "tree.newName": "Silsilah Keluarga {number}",

  // Status chips
  "status.localOnly": "Tersimpan di perangkat ini aja",
  "status.example": "Contoh silsilah, cuma bisa dilihat",

  // Sync status
  "sync.loading": "Memuat",
  "sync.saving": "Lagi nyimpen…",
  "sync.saved": "Tersimpan",
  "sync.offline": "Offline — perubahan disimpan di perangkat ini",
  "sync.conflict": "Ada konflik, perlu dicek",
  "sync.publicStale": "Versi publik belum diperbarui",
  "sync.retry": "Coba lagi",

  // Empty state
  "empty.title": "Mulai dari siapa aja bebas",
  "empty.body": "Pilih siapa aja buat dimasukin duluan: dirimu sendiri, ortu, kakek-nenek, bebas! Nanti bisa dilanjutin ke atas atau ke bawah.",
  "empty.add": "Tambah anggota keluarga",
  "empty.addHint": "Mulai dari diri sendiri atau leluhur",
  "empty.open": "Buka atau impor file silsilah",
  "empty.openHint": "Pilih silsilah lain atau masukkan file backup .heritg",
  "empty.guide": "Panduan pemakaian",
  "empty.guideHint": "Cek cara geser layar, zoom, dan nambahin orang di silsilah",
  "empty.drag": "Geser (drag) atau scroll untuk pindah posisi di layar",

  // Coach marks
  "coach.trees": "Buka, impor, dan atur daftar silsilahmu",
  "coach.share": "Bagikan · Setelan",
  "coach.view": "Pilih keluarga terfokus atau seluruh silsilah",
  "coach.controls": "Cari orang · saring generasi · zoom · pas ke layar",

  // Privacy panel
  "privacy.title": "Perlindungan privasi",
  "privacy.body": "Silsilahmu cuma bisa dibuka dan diedit sama akun pemilik. Selama belum kamu bagikan lewat link, orang lain nggak bisa lihat apa pun.",
  "privacy.maskTitle": "Samarkan tanggal di layar",
  "privacy.maskBody": "Tanggal lahir dan wafat disamarkan pas kamu lagi lihat silsilah di perangkat ini.",

  // Help (temporary until the Bantuan panel lands)
  "help.short": "Tahan dan geser di area kosong buat pindah posisi, pakai tombol zoom, terus pilih satu orang buat nambahin keluarganya.",
} as const;

export type Messages = { [K in keyof typeof id]: string };
