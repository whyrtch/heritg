# heritg.us Parity Reference

> Measured from https://heritg.us on 2026-10-11 (desktop viewport 907x914, root font 16px) by inspecting computed styles, SVG attributes and visible copy. This is a measurement reference for re-implementing the look and flow, not copied source code. Sample data used during capture was fictional (Budi Santoso family).


Stack: Vite PWA (index-*.js, registerSW.js), lang="id". Font: "Assistant", system-ui fallback.

## Tokens (:root)
--add #7e9b63; --base #fffdf8; --brand #a8875b; --brand-deep #795d3f; --canvas #f7f3ec; --danger #b95c4b;
--elevated #fffaf2; --family-plus #73558a; --family-plus-deep #4d345b; --family-plus-hover #422a50;
--family-plus-line #d8cddd; --family-plus-soft #f4eff6; --line #d8ccbc; --recessed #ede5d8;
--shadow 0 18px 46px rgba(62,48,34,.13); --shadow-soft 0 8px 24px rgba(62,48,34,.09); --subtle #796f63;
--text #302b25; --tree-canvas #f5f5f3. Privacy green text rgb(82,112,63) = #52703f.

## Type scale (rem → px)
.92rem 14.72 (buttons 600), .72rem 11.52 (meta, chip 700), .84rem 13.44 (coach 600, lh 16.8), .76rem 12.16 (coach small),
.8rem 12.8 (menu strong 700), .68rem 10.88 (menu small, lh 13.6), .91rem 14.56 (tree list strong 700), .74rem 11.84 (tree list meta),
1.55rem 24.8 (sidebar h1 700, ls -.015em), .79rem 12.64 (sidebar h2 700, ls .06em), .82rem 13.12 (view-mode chip 600).

## Main screen (empty tree)
- Body/main bg #f5f5f3 (tree-canvas). Text #302b25.
- Menu button: abs top18 left22, 44x44 round, bg rgba(255,253,248,.94), 1px #d8ccbc, shadow-soft. Icon 19px (3 lines).
- Header: abs top18 left78 right22, flex gap14, height 58.
  - Title card: padding 8px 14px, bg rgba(255,253,248,.9), border 1px rgba(216,204,188,.88), radius 12, shadow-soft.
    Row: title button (16px, radius 5) + pencil icon button 30x30 round (margin -5 -8 -5 0). Meta "0 orang · 0 hubungan" 11.52px #796f63 margin-top 2.
  - Right actions flex gap 8 (margin-left auto):
    - Family+ 44h, padding 0 14, gap 8, radius 12, linear-gradient(145deg,#73558a,#4d345b), border 1px #4d345b,
      shadow 0 7px 20px rgba(77,52,91,.24), inset 0 1px 0 rgba(255,255,255,.16); icon 20 (circle-plus), text 14.72/600 white.
    - Bagikan 44h, padding 0 14, gap 8, radius 12, bg #fffdf8, border 1px #d8ccbc, no shadow; icon share 17, text 14.72/600.
    - Setelan round 44 icon button (sliders icon 19).
- Canvas controls [Kontrol layar]: abs right18 bottom18, column gap10: Semua orang (users), Jumlah turunan cabang (disabled .45 when empty),
  Zoom In, Zoom Out, Pas ke layar (expand arrows; disabled .45 when empty). All 44 round icon buttons, icons 18-19.
- Bottom-right group [Perlindungan privasi · Bantuan]: right80 bottom18, gap8: privacy chip 44h padding 0 12 gap 6 radius 12 bg rgba(255,253,248,.94)
  border #d8ccbc shadow-soft, shield-check icon 18 + "Dilindungi" 11.52/700 color #52703f; Bantuan round 44 (circle-help).
- Bottom-left group: left18 bottom18 gap 8: Sembunyikan kontrol (eye icon) round 44; "Tampilan pohon" chip 44h padding 0 12 gap 8 radius 12
  bg #fffdf8 NO border, shadow-soft, color #795d3f: git-branch icon 16 + "Lengkap" 13.12/600 + chevron-down 15.
- Coach marks (color #795d3f, 600 weight, number badge 22x22 round 1px border 900 weight 11.52px, margin-right 6):
  1 "Buka, impor, dan atur daftar silsilahmu" (13.44px) below menu with curved arrow pointing up-left to menu (svg 64x78).
  2 "Bagikan · Setelan" right side under actions, arrow up-right.
  3 "Pilih keluarga terfokus atau seluruh silsilah" (12.16px) above bottom-left, arrow down-left.
  4 "Cari orang · saring generasi · zoom · pas ke layar" (12.16px) above controls, arrow down-right.
- Empty state centered (390 wide): logo img (flower mark, brown square radius 22%, 40px in sidebar / larger here) + "Heritg" wordmark brown;
  h "Mulai dari siapa aja bebas" (bold ~1.3rem); p "Pilih siapa aja buat dimasukin duluan: dirimu sendiri, ortu, kakek-nenek, bebas! Nanti bisa dilanjutin ke atas atau ke bawah."
  Options (icon + strong + small): "Tambah anggota keluarga / Mulai dari diri sendiri atau leluhur"; "Buka atau impor file silsilah / Pilih silsilah lain atau masukkan file backup .heritg" (hover bg recessed);
  "Panduan pemakaian / Cek cara geser layar, zoom, dan nambahin orang di silsilah"; hint "✋ Geser (drag) atau scroll untuk pindah posisi di layar" (hand icon).

## Sidebar (aside[Silsilah keluarga], fixed left, 304 wide, slides in)
- padding 22 18 18; bg #f7f3ec + radial-gradient(circle at 20% 3%, rgba(168,135,91,.12), transparent); shadow --shadow.
- Head: logo img 40x40 radius 22% shadow 0 6px 16px rgba(62,48,34,.16); "Heritg" h1 24.8/700 ls -.015em; "Arsip keluarga pribadi" 10.88 ls .06em #796f63; close X round 44 (transparent border).
- Section row: "Silsilah keluarga" h2 12.64/700 ls .06em + "Silsilah baru" plus round button.
- Search: input 42h radius 12 bg rgba(255,253,248,.78) border #d8ccbc padding-left 39, search icon 17 #796f63 at left 13.
- Tree item card: grid, padding 7 7 7 9, radius 14, bg #fffdf8, border #d8ccbc, shadow 0 7px 18px rgba(62,48,34,.08):
  avatar 38 round bg #ede5d8 color #795d3f (tree icon 19) + strong 14.56/700 + "0 orang · 11 Okt" 11.84 #796f63; kebab "Atur Silsilah" round 44.
- Buttons: "Silsilah baru" 44h radius 12 bg #795d3f white 14.72/600 shadow 0 5px 13px rgba(121,93,63,.2) icon plus; "Impor file" 44h radius 12 bg #fffdf8 border (upload icon).
- Menu list (border-top, padding-top 10, gap 2), rows 50-60h radius 11 padding 7 8 gap 11, icon 17 #795d3f, strong 12.8/700, small 10.88 lh 13.6 #796f63:
  Heritg Family+ (gradient purple bg, white, "Paket dan perangkat terhubung"); Perlindungan privasi ("Terenkripsi di perangkat ini", lock icon);
  Bantuan ("Cek cara geser layar, zoom, dan nambahin orang di silsilah"); Laporin bug ("Kirim detail error ke kita lewat WhatsApp atau Telegram", bug icon).

## Dialog (Mulai bikin silsilah / add person)
- 620 wide, radius 22, bg #f7f3ec, border 1px rgba(216,204,188,.9), shadow 0 26px 70px rgba(48,43,37,.25).
- Head title + X; photo card (gradient recessed box with avatar circle initial + "Pilih foto" pill); "Nama" field; collapsible "Tambah info (opsional)" (+);
  footer Batal (outline) + "Tambah orang" (#795d3f, 44h radius 12, shadow 0 5px 13px rgba(121,93,63,.2)).
- Discard confirm "Batal simpan?" small dialog: text "Biodata dan perubahan silsilah yang baru kamu ketik belum disimpan nih." buttons Batal / "Buang editan" (danger #b95c4b).

## Tree canvas (SVG, not cards)
- Nodes: circle r=32 + inner r=27 (photo area); initial 24/700 #302b25; name 14/700 at y=56; relation sub-label 13/500 #796f63 at y=77.
- Gender palette: male fill #e2ebf2 stroke #56738d sw1; female #f4e4e8 / #985c6d sw1; unspecified #ede5d8 / #9c825f (sw2 seen on selected).
- Grid: 260px column, 260px row. Lines: parent-child stroke #9c825f 2px round caps, orthogonal (drop 8px under parents' labels, bus line, down to child top r).
  Partner line stroke #b47c76 2px straight between circles.
- Selected node: two 28px action dots left of node (hit 44): edit = #a8875b with pencil, add = #7e9b63 (--add) with plus; shadow 0 3px 9px rgba(62,48,34,.2).
- Relation labels relative to selected: Orang terpilih, Ayah, Ibu, Istri, Suami, Putra, Putri, Cucu laki-laki, ...
- Invisible hit buttons: aria-label "<Name>, <Gender label>" (gender labels: Laki-laki, Perempuan, Nggak disebutin), aria-pressed when selected.

## View modes (bottom-left chip "Tampilan pohon")
- Popover 304w radius 16 bg #fffdf8 padding 10: segmented control (bg #ede5d8 radius 10 pad 3; active seg bg #fffdf8 radius 8 shadow) Fokus | Lengkap | Kipas;
  "Jelajahi keluarga dari" person picker (avatar + name); "Menampilkan 6 dari 7 orang"; checkbox "Tampilkan saudara" (+ hint);
  footer buttons "↑ Leluhur lainnya" / "↓ Keturunan lainnya".
- Fokus: selected + parents + partner(s) + children. Lengkap: whole tree, extra "Hubungan" chip above (legend). Kipas: separate page (Kembali / Kembali ke pohon,
  "Kipas" h, "Leluhur di atas, anak di bawah. Ketuk siapa pun untuk melanjutkan penjelajahan.", selects Generasi + Ukuran bagan, semicircle fan, "Belum tercatat" slots, list below).

## Add-relative wizard ("Tambah kerabatnya <Name>", 620 dialog, stepper 1-2-3 "Langkah N dari 3")
1. "Mau nambahinnya gimana?" cards: Bikin orang baru / Sambungin ke kerabat yang udah ada (disabled + note when nobody else).
2. "Pilih status hubungan" / "Orang ini siapanya <Name>?" groups (2-col buttons 53h radius 12, round icon 31 bg #ede5d8, arrow up/down/heart):
   Paling sering: Ayah, Ibu, Anak laki-laki, Anak perempuan, Istri, Suami.
   Orang tua & Wali: Ayah tiri, Ibu tiri, Ayah angkat, Ibu angkat, Ayah asuh, Ibu asuh, Wali.
   Suami/Istri & Pasangan: Pasangan, Mantan pasangan, Mantan suami, Mantan istri.
   Anak: Anak tiri laki-laki/perempuan, Anak angkat laki-laki/perempuan, Anak asuh laki-laki/perempuan, Anak asuhan (Wali).
   (likely more groups below: Saudara...). Footer Kembali / Batal.
3. "Profil <Relasi> baru": Status Hubungan readout; Tanggal nikah (opsional) for spouses; photo row (68 avatar tinted by implied gender) + Pilih foto;
   Nama (56h input, 17.28px); details "Tambah info (opsional)": Tanggal lahir, Domisili saat ini. Submit "Tambah anggota keluarga" (green #7e9b63).
- Stepper: dots 25 round, done/current bg #795d3f white 11.52/700; connectors 64x2 (#795d3f done / #d8ccbc todo); pending dot bg #ede5d8 border #d8ccbc.

## Edit profile ("Edit profil <Name>", 780 dialog)
- Avatar 76 + Pilih foto. Section cards (bg #fffdf8, border, radius 15, pad 16): "Biodata lengkap": Nama; Gender select (Nggak disebutin/Perempuan/Laki-laki);
  Domisili saat ini; Tanggal lahir (custom date button); Anak ke-berapa (number + hint); Tanggal wafat.
  "Catatan tambahan" textarea. "Keluarga" + "Sambungin anggota keluarga" button; rows (avatar 44, name 16/700, relation 12): edit tanggal nikah, edit hubungan, hapus hubungan (danger).
- Inputs inside cards: bg #ede5d8, transparent border, radius 11, pad 10 12, 14.72px.

## Side panels (390 wide, full height): Semua orang (search + list with relation labels), Setelan, Bagikan / Ekspor, Bantuan, Perlindungan privasi.
- Setelan: AKSES FAMILY+ (Belum aktif, Otomatis sinkron, Aktifkan), AKUN (optional login; data stays on device), BAHASA APLIKASI (ID/EN/MS),
  SEBUTAN STATUS KELUARGA (EN/ID/MS/Jawa Yogyakarta/Jawa ...).
- Bagikan / Ekspor: Bikin Link Web (password-protected, encrypted), File Backup HERITG (recommended), File GEDCOM, Simpan Gambar (PNG/SVG).
- Family+ dialog 620: benefits list (sync across devices, longer share links, encrypted backup, everyday features stay free).
- Bantuan: sections Geser-geser kanvas / Nambah dan ngedit keluarga / Ngatur silsilah / Nyari orang dengan cepat ...
- Perlindungan privasi: AES-GCM local encryption explainer; local storage, no account needed.

## Empty state (measured on a fresh empty tree)
- A brand-new empty tree auto-opens the "Mulai bikin silsilah" dialog.
- Column 390 wide, centered (text-align center): logo row (img 44 radius 22% shadow 0 6px 16px rgba(62,48,34,.16) + "Heritg" 24.8/700 ls -.03em #795d3f, gap 10, mb 20);
  h3 21.6/700 mb 6; p 13.76 lh 19.95 #796f63 margin 0 30 18; options column margin 0 25, gap 3: buttons 340 wide, padding 8 12, gap 12, radius 11,
  left-aligned, icon 19 #795d3f, strong 14.08/700, small 11.36 lh 14.2 #796f63 mt 3; hint row mt 17 gap 6, 11.52 #796f63 with hand icon 15.
- Title card h2 17.92/700 ls -.01em.
- Coach marks: #1/#2 svg 64x78 arrows (stroke 1.8, #795d3f), text 13.44/600; #3/#4 svg 76x58 arrows (stroke 1.7), text 12.16/600.
  Positions (907 wide): #1 box left 22 top 140 (arrow above-left toward menu); #2 box right 22 top 140 (arrow toward Setelan);
  #3 box left ~70 bottom ~72 (above view chip, arrow down-left); #4 box right ~48 bottom 280 (above controls, arrow down-right).

## Mobile (375x812)
- Inset 10-12px. Top row: menu 44 (12,10); title card (64,10, 299 wide, 44 high, name ellipsized) + round 44 icon buttons Family+ (purple gradient), Bagikan, Setelan.
- Coach marks 1, 2 and 3 visible; 4 hidden. Empty-state options full width (340), left aligned.
- Controls column right 12, bottom 12 (Semua orang ... Pas ke layar, 44 each, gap 8). Privacy chip becomes a round 44 icon-only button, with Bantuan next to it (row at y 700).
- Bottom-left: eye (12,756) + view chip "Lengkap" (64,756, 122x44).
