# KuponMalam.com Design System

> Versi pendamping PRD 1.0 — 14 September 2026. Disusun dari DESIGN(1).md yang diberikan pengguna. Salinan ini mempertahankan arah visual sumber dan menyelaraskan fondasi teknis dengan keputusan TanStack Start/Router. File sumber asli tidak diubah.

Dokumen ini menjadi sumber acuan visual dan UI untuk portal KuponMalam.com. Sistem produk terdiri dari satu aplikasi yang menggabungkan pengalaman kupon dan tiket. Seluruh aturan di bawah ini berlaku untuk halaman publik, katalog, detail penawaran, checkout, tiket digital, akun pengguna, notifikasi, dan halaman pendukung lainnya.

Dokumen ini mendefinisikan bahasa visual, token desain, komponen, layout, responsive behavior, motion, dan aturan aksesibilitas. Dokumen ini tidak mendefinisikan database, backend, RBAC, kontrak API, atau implementasi internal pihak ketiga.

## 1. Design Direction

### 1.1 Visual personality

- Editorial tech.
- Night lifestyle.
- Modern dan premium, tetapi tetap mudah dipahami.
- High contrast dengan ruang kosong yang cukup.
- Berani pada headline dan CTA, tenang pada area informasi.
- Menggunakan aksen merah sebagai identitas utama dan aksen hangat untuk konteks promo.

### 1.2 Prinsip desain

1. **Low friction** — pengguna dapat menemukan, memahami, dan mengklaim penawaran dengan langkah sesedikit mungkin.
2. **Clear hierarchy** — harga, benefit, masa berlaku, lokasi, dan CTA harus langsung terlihat.
3. **Trust first** — informasi transaksi, status tiket, syarat penggunaan, dan validitas penawaran harus eksplisit.
4. **Mobile-first** — mayoritas aktivitas pengguna dirancang nyaman untuk layar kecil dan penggunaan satu tangan.
5. **Consistent by tokens** — warna, spacing, radius, typography, dan motion tidak boleh dibuat ad hoc per halaman.
6. **Purposeful motion** — animasi membantu orientasi dan feedback, bukan sekadar dekorasi.
7. **Accessible by default** — kontras, focus state, target sentuh, struktur semantik, dan reduced motion harus diperhatikan sejak awal.

### 1.3 Scope visual MVP

- Satu portal dengan fitur kupon dan tiket sebagai fitur internal yang saling terhubung.
- Fokus pada discovery, filter, detail penawaran, claim, pembayaran bila diperlukan, tiket digital, riwayat, dan profil.
- Tampilan interaktif untuk peta malam dan denah interior 1:1 belum termasuk MVP.
- Identitas visual dan UI pihak ketiga tidak didefinisikan di dalam design system ini.

## 2. Technical Foundation

### 2.1 UI foundation

Gunakan model token dan komponen yang kompatibel dengan pola berikut:

- Tailwind CSS sebagai utility dan token layer.
- HeroUI sebagai component foundation, dengan pola Button, Input, ComboBox/Autocomplete, Dropdown, Modal, Card, dan komponen stateful lainnya. Navbar dibuat sebagai komponen layout custom. Nama API mengikuti versi HeroUI yang dikunci, bukan menyalin contoh NextUI/HeroUI lama.
- React Aria-style interaction pattern untuk keyboard navigation, focus management, press state, dan accessible overlay.
- TypeScript + React sebagai target implementasi portal.
- TanStack Start sebagai framework portal, dengan TanStack Router sebagai routing bawaan. Tidak menggunakan React Router atau Next.js dalam stack terpilih.
- Vite sebagai build tooling sesuai setup TanStack Start yang dikunci.
- TanStack Query untuk server state/cache API; route loader mengorkestrasi prefetch tanpa menduplikasi cache entity.
- React Hook Form + Zod untuk form kompleks dan validasi input frontend, mengikuti kontrak backend.
- Tailwind CSS v4-compatible stack dan HeroUI versi kompatibel dipilih serta dikunci bersama.
- CSS transitions untuk interaksi sederhana dan Motion for React untuk animasi UI yang memerlukannya. Motion tidak diasumsikan sebagai dependency internal HeroUI.

Komponen boleh dibuat custom apabila kebutuhan bisnis tidak tercukupi oleh primitive yang tersedia, tetapi tetap harus memakai token yang didefinisikan dalam dokumen ini.

### 2.2 Implementation constraints

- Portal hanya berkomunikasi melalui Backend API yang tersedia.
- Frontend tidak boleh mengakses PostgreSQL atau database secara langsung.
- Reuse pola autentikasi, validasi, pagination, media, error handling, dan response state yang sudah tersedia.
- Hindari state management berat dan pola implementasi baru yang tidak diperlukan.
- Guest mode dan alur akses rendah-friksi harus tetap didukung sesuai kebutuhan produk.

## 3. Color System

Gunakan semantic token dalam komponen. Jangan menanamkan warna hex langsung di halaman kecuali untuk asset brand atau kebutuhan visual yang sudah disetujui.

### 3.1 Core colors

| Token | Light mode | Dark mode | Penggunaan |
|---|---:|---:|---|
| `background` | `#FFFFFF` | `#000000` | Background utama halaman |
| `foreground` | `#11181C` | `#ECEDEE` | Teks utama dan ikon utama |
| `primary` | `#CA2222` | `#DC2626` | CTA utama, link aktif, highlight brand |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` | Teks di atas primary |
| `secondary` | `#E5E7EB` | `#0F172A` | Surface pendukung, area sekunder |
| `muted` | `#F3F4F6` | `#262626` | Surface lembut, placeholder, footer |
| `muted-foreground` | `#6A7282` | `#A1A1AA` | Teks sekunder dan metadata |
| `border` | `#E5E7EB` | `#27272A` | Border dan divider |
| `focus` | `#155DFC` | `#155DFC` | Focus ring keyboard |

### 3.2 Semantic colors

| Status | Warna dasar | Penggunaan |
|---|---:|---|
| Success | `#16A34A` | Berhasil claim, pembayaran berhasil, tiket valid |
| Warning | `#FBBF24` | Hampir habis, segera berakhir, perlu perhatian |
| Danger | `#F31260` | Gagal, ditolak, expired, pembatalan |
| Info | `#155DFC` | Informasi, instruksi, status proses |
| Promo warm accent | `#F59E0B` | Diskon, harga spesial, benefit promo |

### 3.3 Color rules

- Merah adalah aksen utama, bukan warna untuk semua status error.
- Gunakan merah untuk CTA primer dan emphasis yang memang membutuhkan perhatian.
- Gunakan amber/gold untuk konteks diskon atau keuntungan ekonomi agar tidak tercampur dengan error.
- Gunakan hijau hanya untuk status sukses atau valid.
- Jangan menggunakan teks abu-abu muda di atas background putih jika kontrasnya tidak mencukupi.
- Dark mode memakai hitam sebagai canvas utama dan surface slate/neutral sebagai lapisan informasi.
- Glow dan gradient hanya boleh menjadi efek pendukung; konten tetap harus terbaca tanpa efek tersebut.

## 4. Typography

### 4.1 Font family

```css
font-family: Poppins, ui-sans-serif, system-ui, sans-serif;
```

Poppins digunakan untuk seluruh interface. Gunakan fallback system sans-serif apabila font utama gagal dimuat.

### 4.2 Font weights

| Weight | Nama | Penggunaan |
|---:|---|---|
| 400 | Regular | Body text, deskripsi, helper text |
| 500 | Medium | Input, nav, label, metadata penting |
| 600 | Semibold | Subheading, label aktif, button sekunder |
| 700 | Bold | Button, nav aktif, harga penting |
| 800 | Extra bold | Heading section tertentu |
| 900 | Black | Display heading dan CTA hero |

### 4.3 Type scale

| Token | Desktop | Mobile | Weight | Line height | Penggunaan |
|---|---:|---:|---:|---:|---|
| `display` | `128px` | `48px` | 900 | `0.85` | Hero headline |
| `heading-1` | `72px` | `40px` | 900 | `0.9` | Headline halaman |
| `heading-2` | `56px` | `36px` | 900 | `0.9` | Section heading |
| `heading-3` | `36px` | `28px` | 800–900 | `1.0` | Card atau feature heading |
| `title` | `24px` | `20px` | 700–800 | `1.2` | Judul penawaran |
| `body-lg` | `20px` | `18px` | 400–500 | `1.6` | Intro atau lead paragraph |
| `body` | `16px` | `16px` | 400–500 | `1.5` | Konten utama |
| `body-sm` | `14px` | `14px` | 400–500 | `1.45` | Deskripsi sekunder |
| `caption` | `12px` | `12px` | 500–600 | `1.33` | Metadata, status, helper |

### 4.4 Typography rules

- Display heading menggunakan `letter-spacing: -0.05em`.
- Heading besar memakai line-height pendek agar terasa editorial dan padat.
- Kata atau frasa penting dapat menggunakan warna primary dan italic.
- Body text menggunakan line-height longgar untuk keterbacaan.
- Hindari uppercase untuk paragraf atau informasi panjang.
- Eyebrow, metadata, status, dan label kecil boleh uppercase dengan letter spacing positif.

## 5. Spacing System

Gunakan grid dasar `4px`.

| Token | Nilai |
|---|---:|
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `12px` |
| `space-4` | `16px` |
| `space-5` | `20px` |
| `space-6` | `24px` |
| `space-8` | `32px` |
| `space-10` | `40px` |
| `space-12` | `48px` |
| `space-16` | `64px` |
| `space-20` | `80px` |
| `space-24` | `96px` |
| `space-32` | `128px` |

### Layout spacing

- Maximum content width: `1280px`.
- Desktop page gutter: `24px` minimum.
- Mobile page gutter: `16px` minimum.
- Header height: `64px`.
- Section vertical spacing desktop: `96px–160px`.
- Section vertical spacing mobile: `64px–96px`.
- Card internal padding: `16px–24px`.
- Group gap kecil: `8px–12px`.
- Group gap utama: `16px–24px`.

## 6. Shape, Border, and Elevation

### 6.1 Radius tokens

| Token | Nilai | Penggunaan |
|---|---:|---|
| `radius-sm` | `8px` | Button kecil, badge, control kecil |
| `radius-md` | `12px` | Input, card standar, dropdown |
| `radius-lg` | `14px` | Media, panel, surface besar |
| `radius-xl` | `16px` | Card promo atau panel featured |
| `radius-2xl` | `24px` | Container visual besar |
| `radius-pill` | `9999px` | Search, chip, CTA, tab, bottom nav |

Bentuk pill adalah ciri utama untuk control dan CTA. Jangan menerapkan radius besar secara otomatis pada semua container; gunakan radius sesuai hierarki komponen.

### 6.2 Border

- Border standar: `1px solid` dengan warna `border`.
- Border emphasis: `2px solid` untuk selected state atau control penting.
- Divider: `1px` dengan opacity rendah.
- Focus ring: `2px` dengan offset minimal `2px`.
- Hindari border gelap tebal pada surface yang sudah memiliki shadow.

### 6.3 Shadow and elevation

| Token | Karakter |
|---|---|
| `shadow-sm` | Soft, hampir tidak terlihat, untuk control atau card ringan |
| `shadow-md` | Elevation menengah untuk dropdown, card aktif, panel |
| `shadow-lg` | Elevation tinggi untuk modal, hero search, CTA utama |
| `shadow-primary` | Glow lembut dengan warna primary untuk CTA penting |
| `shadow-2xl` | Dramatic elevation untuk hero atau CTA final |

Shadow harus lebih lembut pada light mode dan boleh memiliki inner highlight halus pada dark mode. Jangan menggunakan shadow sebagai satu-satunya pembeda status.

## 7. Surface and Effects

### 7.1 Surface hierarchy

1. `background` — canvas utama.
2. `content-1` — card atau panel utama.
3. `content-2` — panel sekunder dan area yang membutuhkan pemisahan ringan.
4. `muted` — area informasi sekunder, footer, placeholder, atau empty state.
5. `overlay` — modal, dropdown, command surface, dan navigasi floating.

### 7.2 Glass surface

Gunakan pola glass secara terbatas pada header, search bar, floating navigation, dan overlay:

```css
background: rgb(255 255 255 / 80%);
backdrop-filter: blur(16px);
border: 1px solid rgb(229 231 235 / 50%);
```

Pada dark mode, gunakan surface neutral/slate dengan opacity serupa. Konten penting tidak boleh bergantung pada translucency untuk mendapatkan kontras.

### 7.3 Decorative effects

- Radial glow primary yang sangat halus pada hero atau CTA final.
- Grid background dengan jarak sekitar `48px` hanya sebagai dekorasi.
- Blur blob atau ambient light dengan opacity rendah.
- Particle atau dot kecil hanya pada layar marketing atau landing page.
- Foto dapat dimulai grayscale dan berubah ke warna penuh saat hover pada desktop.

## 8. Component System

### 8.1 Navbar

- Sticky pada bagian atas.
- Tinggi `64px`.
- Container maksimum `1280px`.
- Padding horizontal minimal `24px` desktop dan `16px` mobile.
- Background semi-transparan dengan backdrop blur.
- Navigation aktif menggunakan warna primary dan weight lebih tebal.
- Link tidak aktif menggunakan foreground atau muted-foreground.
- Theme toggle memiliki accessible label.
- Pada mobile, navigasi utama berubah menjadi menu atau bottom navigation sesuai konteks halaman.

### 8.2 Button

#### Variants

- **Primary** — background primary, teks putih, CTA utama.
- **Secondary** — surface secondary atau muted, teks foreground.
- **Outline** — background transparan, border, teks foreground.
- **Ghost** — tanpa border dan background, muncul pada hover atau pressed state.
- **Danger** — hanya untuk tindakan destruktif atau pembatalan.

#### Sizes

| Size | Height | Bentuk |
|---|---:|---|
| Small | `32px` | `radius-sm` |
| Medium | `40px–48px` | `radius-md` atau pill |
| Large | `56px` | Pill untuk CTA penting |
| Hero | `80px` | Pill, hanya untuk CTA campaign atau landing |

#### States

- Default.
- Hover: opacity atau scale kecil, maksimum sekitar `1.05`.
- Pressed: scale sekitar `0.95–0.98`.
- Focus-visible: focus ring jelas.
- Disabled: opacity sekitar `0.5`, tidak boleh terlihat aktif.
- Loading: pertahankan ukuran button dan tampilkan indikator proses.

### 8.3 Search and filter

- Search adalah entry point utama katalog.
- Desktop dapat menggunakan satu search bar besar berbentuk pill dengan field keyword, lokasi, dan CTA.
- Mobile menggunakan layout stacked dengan field yang tetap mudah disentuh.
- Tinggi field utama minimal `48px`.
- Ikon pencarian berada di sisi kiri dan memakai warna primary secara hemat.
- Location selector menggunakan combobox/autocomplete yang keyboard-accessible.
- Filter aktif ditampilkan sebagai chip yang dapat dihapus.
- Empty state harus menjelaskan apa yang dapat dilakukan pengguna berikutnya.

### 8.4 Cards

Card harus memiliki struktur yang konsisten:

1. Media atau logo.
2. Badge/status.
3. Judul penawaran.
4. Merchant atau penyelenggara.
5. Lokasi dan masa berlaku.
6. Harga atau benefit utama.
7. CTA atau affordance untuk melihat detail.

Aturan card:

- Gunakan surface dan border untuk pemisahan dasar.
- Gunakan shadow hanya pada card yang benar-benar elevated atau interactive.
- Informasi harga dan masa berlaku tidak boleh disembunyikan di hover.
- Badge status memiliki warna semantic yang konsisten.
- Card clickable harus memiliki hover, focus, dan pressed state.

### 8.5 Badges and chips

- Badge kecil menggunakan caption atau body-sm semibold.
- Chip filter menggunakan pill radius.
- Badge promo dapat memakai promo warm accent.
- Badge sukses, warning, danger, dan info harus memakai semantic colors.
- Jangan menyampaikan status hanya melalui warna; tambahkan teks atau ikon.

### 8.6 Input, select, and autocomplete

- Height standar minimal `48px`.
- Radius `12px` atau pill untuk search.
- Placeholder menggunakan muted-foreground.
- Label harus tetap tersedia; jangan mengandalkan placeholder sebagai satu-satunya label.
- Focus state menggunakan border/focus ring yang jelas.
- Error state menampilkan pesan yang spesifik di dekat field.
- Icon tidak boleh mengurangi area sentuh atau area input.

### 8.7 Modal, dropdown, and overlay

- Surface overlay memiliki background solid atau opacity yang cukup untuk keterbacaan.
- Gunakan shadow-lg atau shadow-2xl sesuai ukuran overlay.
- Modal wajib memiliki heading, close action, focus management, dan keyboard escape.
- Dropdown harus memiliki active, focus, selected, disabled, dan empty states.
- Hindari menumpuk terlalu banyak overlay dalam satu alur.

### 8.8 Ticket and voucher surfaces

- Status tiket/kupon harus mudah dipindai dalam satu pandangan.
- Gunakan card atau panel dengan status yang kuat, bukan dekorasi berlebihan.
- QR/barcode area membutuhkan ruang putih dan tidak boleh diberi filter atau opacity.
- Informasi penting: nama penawaran, merchant, tanggal berlaku, status, kode/QR, dan instruksi penggunaan.
- Status expired atau redeemed tidak boleh disampaikan hanya dengan membuat seluruh card abu-abu; tampilkan label yang eksplisit.

### 8.9 Mobile bottom navigation

- Digunakan untuk area utama yang sering dikunjungi.
- Tinggi sekitar `56px`.
- Berbentuk floating pill atau surface rounded dengan shadow.
- Setiap item minimal memiliki icon dan accessible label.
- Item aktif memakai primary.
- Jangan menampilkan lebih banyak item daripada yang dapat dibaca dalam satu baris.

### 8.10 Footer

- Menggunakan background gradient sangat halus dari background ke muted.
- Link dikelompokkan berdasarkan fungsi.
- Heading kolom memakai semibold.
- Link sekunder memakai muted-foreground dan berubah ke primary saat hover.
- Informasi legal dan kontak tetap mudah ditemukan.

## 9. Layout Patterns

### 9.1 Hero / discovery

- Minimum height sekitar `90vh` untuk landing page.
- Konten dipusatkan dengan max-width `1280px`.
- Headline besar, kontras tinggi, dan memiliki satu emphasis primary.
- Search atau discovery CTA diletakkan dekat headline.
- Dekorasi grid, glow, dan particle berada di belakang konten.
- Elemen dekoratif tidak boleh mengganggu input dan CTA.

### 9.2 Catalog

- Search dan filter berada dekat bagian atas.
- Gunakan grid card pada desktop dan satu kolom pada mobile.
- Filter sidebar boleh digunakan pada desktop; pada mobile ubah menjadi bottom sheet atau filter button.
- Sort, result count, dan active filter harus tetap terlihat.

### 9.3 Detail offer

- Media dan informasi utama mendapat prioritas visual.
- Harga, benefit, availability, location, dan CTA dikelompokkan.
- Syarat dan ketentuan dapat dibuka tanpa menghilangkan konteks utama.
- CTA utama dapat dibuat sticky pada mobile jika tidak menutupi informasi penting.

### 9.4 Checkout / claim

- Kurangi distraksi dan dekorasi.
- Tampilkan progress atau step indicator bila alurnya multi-step.
- Ringkasan order selalu mudah diakses.
- Error validasi muncul dekat sumber masalah.
- Status loading dan success harus memiliki feedback yang jelas.

### 9.5 Ticket / voucher detail

- Gunakan layout fokus pada status dan redemption.
- Letakkan QR/barcode dalam surface yang bersih.
- Sediakan instruksi penggunaan yang singkat dan mudah dipindai.
- Riwayat status menggunakan timeline atau grouped activity bila diperlukan.

## 10. Responsive Behavior

Gunakan breakpoint Tailwind standar sebagai baseline:

| Breakpoint | Lebar | Behavior |
|---|---:|---|
| Mobile | `<640px` | Satu kolom, bottom navigation, CTA full-width |
| Small tablet | `640px–767px` | Grid ringan, spacing menengah |
| Tablet | `768px–1023px` | Dua kolom bila konten mendukung |
| Desktop | `1024px–1279px` | Navbar lengkap, grid dan sidebar opsional |
| Wide desktop | `>=1280px` | Max-width container, whitespace lebih luas |

Rules:

- Semua layout multi-kolom harus collapse dengan baik menjadi satu kolom.
- Jangan mengecilkan teks display secara ekstrem hingga hierarchy hilang.
- CTA penting pada mobile minimal selebar kontainer atau full-width.
- Target sentuh minimal `44px × 44px`.
- Hover-only behavior tidak boleh menjadi satu-satunya cara mengakses informasi.
- Gunakan `prefers-reduced-motion` untuk mengurangi atau menghapus motion yang tidak perlu.

## 11. Motion System

### 11.1 Timing

| Token | Durasi | Penggunaan |
|---|---:|---|
| `motion-fast` | `150ms` | Hover, focus, pressed |
| `motion-standard` | `300ms` | Opacity, color, small transform |
| `motion-emphasis` | `500ms` | CTA, panel, navigation |
| `motion-slow` | `700ms–2s` | Reveal, image transition, section entry |
| `motion-ambient` | `5s–8s` | Pulse atau ambient decorative loop |

### 11.2 Easing

- Standard: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Enter: `cubic-bezier(0, 0, 0.2, 1)`.
- Exit: `cubic-bezier(0.4, 0, 1, 1)`.

### 11.3 Approved motion patterns

- Fade and translate reveal saat section masuk viewport.
- Blur-to-clear pada headline atau visual hero.
- Scale kecil pada hover dan pressed state.
- Arrow atau icon bergeser sedikit saat link di-hover.
- Grayscale-to-color pada image hover desktop.
- Pulse atau bounce hanya untuk decorative ambient element.
- Skeleton/loading state untuk proses asynchronous.

### 11.4 Motion rules

- Jangan menganimasikan layout besar setiap kali state berubah.
- Jangan menggunakan infinite animation pada elemen yang harus dibaca terus-menerus.
- Motion harus memiliki tujuan: orientation, feedback, hierarchy, atau delight yang relevan.
- Semua motion non-essential harus memiliki reduced-motion fallback.
- Pastikan animasi tidak mengurangi performa pada perangkat mobile.

## 12. Iconography and Imagery

### Icons

- Gunakan inline SVG atau icon library yang konsisten.
- Ukuran umum: `16px`, `18px`, `20px`, `24px`.
- Stroke umumnya `1.5–2px`.
- Ikon dekoratif boleh memakai warna primary, tetapi ikon status harus mengikuti semantic colors.
- Setiap icon-only button wajib memiliki accessible label.

### Imagery

- Gunakan foto yang terasa malam, urban, hangout, event, merchant, atau pengalaman nyata.
- Prioritaskan crop yang jelas dan subject yang mudah dikenali.
- Gunakan grayscale sebagai treatment editorial pada area tertentu, bukan pada semua gambar.
- Foto tidak boleh mengalahkan informasi harga, status, atau CTA.
- Pastikan ratio media konsisten dalam satu collection.

## 13. Accessibility Checklist

- Semua interactive element dapat diakses dengan keyboard.
- Focus-visible state terlihat jelas pada light dan dark mode.
- Kontras teks mengikuti standar aksesibilitas yang sesuai.
- Informasi status tidak hanya dikomunikasikan dengan warna.
- Semua input memiliki label yang dapat dibaca screen reader.
- Semua gambar informatif memiliki alt text yang sesuai.
- Icon-only control memiliki accessible name.
- Target sentuh minimal `44px × 44px`.
- Modal dan dropdown memiliki focus management yang benar.
- Loading, error, success, empty, dan disabled state memiliki feedback tekstual.
- Hormati `prefers-reduced-motion`.
- Jangan menghapus outline keyboard tanpa menggantinya dengan focus indicator yang setara.

## 14. Do and Don't

### Do

- Gunakan token semantic untuk warna dan spacing.
- Pertahankan headline besar dengan hierarchy yang tegas.
- Gunakan pill pada CTA, search, chip, dan navigasi floating.
- Tampilkan harga, benefit, lokasi, masa berlaku, dan status secara eksplisit.
- Pertahankan kontras tinggi dan whitespace yang cukup.
- Gunakan motion untuk feedback dan orientation.
- Uji setiap komponen pada light mode, dark mode, mobile, keyboard, dan reduced motion.

### Don't

- Jangan membuat halaman dengan warna, radius, atau shadow baru tanpa alasan.
- Jangan menggunakan merah sebagai pengganti semua status.
- Jangan menyembunyikan informasi penting hanya pada hover.
- Jangan membuat layout desktop mengecil secara paksa di mobile.
- Jangan memakai gradient atau glow yang mengurangi keterbacaan.
- Jangan memakai motion infinite pada konten utama.
- Jangan membuat QR/barcode transparan, blur, atau terlalu kecil.
- Jangan menghubungkan UI langsung ke database.
- Jangan memasukkan fitur map dan denah interior interaktif ke scope MVP.

## 15. Definition of Done for UI

Sebuah halaman dianggap sesuai design system apabila:

- Menggunakan token warna, typography, spacing, radius, border, dan elevation yang tersedia.
- Memiliki hierarchy yang jelas untuk heading, content, status, dan CTA.
- Memiliki state default, hover, focus, pressed, disabled, loading, error, empty, dan success bila relevan.
- Responsif pada mobile, tablet, desktop, dan wide desktop.
- Tidak bergantung pada hover untuk akses informasi penting.
- Mendukung keyboard navigation dan reduced motion.
- Tidak menambahkan akses langsung ke database atau mengubah kontrak Backend API.
- Tidak memasukkan area yang sudah ditetapkan di luar MVP.



## 16. Penyelarasan implementasi portal

### 16.1 Batas produk

- Satu aplikasi bernama KuponMalam.com dengan kupon dan tiket sebagai modul internal.
- Deliverable MVP hanya portal pengguna. Admin App, RBAC, backend domain, dashboard merchant dan scanner operasional merupakan sistem/dependency perusahaan.
- Sistem ketenagakerjaan pihak ketiga tidak termasuk produk internal portal.
- Halaman P0/P1/P2 mengikuti [PRD.md](./PRD.md); design system tidak mengaktifkan fitur roadmap secara otomatis.
- Tidak ada akses langsung database, implementasi payment webhook, penerbitan token QR otoritatif, atau perhitungan final harga pada frontend.

### 16.2 Penyesuaian konteks halaman

- Hero minimum 90vh, display 128px dan spacing marketing besar berlaku untuk landing marketing. Beranda discovery harian, katalog, akun dan checkout memakai kepadatan sesuai kebutuhan informasi.
- Gunakan skala fluid yang dibatasi token mobile/desktop; pastikan headline tidak terpotong oleh line-height ketat.
- Sticky CTA dan floating bottom navigation memperhitungkan safe-area, virtual keyboard dan focus target; keduanya tidak saling menutupi.
- Small button visual 32px tetap memiliki hit area minimal 44px x 44px pada interaksi sentuh.
- Animasi ambient tidak digunakan pada checkout dan QR. Jangan menunda akses harga/CTA demi reveal.
- Rotasi QR mengikuti backend. Saat token expired atau koneksi terputus, status terlihat jelas; QR lama tidak diberi label valid.
- Data sensitif dan token tidak muncul dalam URL, metadata share, logging, atau public cache.

### 16.3 Token yang harus difinalisasi sebelum implementasi halaman

Dokumen sumber menetapkan nama surface/elevation berikut, tetapi belum menetapkan seluruh nilai literal. Ini adalah design decision terbuka; jangan mengarang nilai berbeda per halaman.

| Token/area | Yang perlu dilengkapi | Pemilik |
|---|---|---|
| content-1, content-2 | Nilai light/dark dan pasangan teks | Design/front-end |
| overlay | Nilai modal/dropdown dan backdrop | Design/front-end |
| shadow-sm/md/lg/primary/2xl | Nilai offset, blur, spread, alpha light/dark | Design/front-end |
| Semantic foreground/background | Pasangan success/warning/danger/info yang lolos kontras | Design/front-end |
| Primary foreground | Verifikasi kontras merah-putih pada seluruh state | Design/front-end |
| Typography fluid | Clamp/interpolation dan batas wrapping per layout | Design/front-end |

Nilai warna base pada bagian 3 tidak otomatis menjamin kontras seluruh kombinasi. Uji pasangan warna nyata, ukuran teks dan state. Target aksesibilitas rekomendasi PRD adalah WCAG 2.2 AA; kelulusan diperiksa melalui pengujian, bukan diasumsikan dari pemakaian component library.

### 16.4 Implementasi dan verifikasi

- Simpan token pada src/styles/tokens.css dan gunakan melalui semantic classes/variables. Konfigurasi mapping HeroUI mengikuti API versi terkunci.
- Komponen interaksi menggunakan primitives HeroUI. CouponCard, EventCard, OfferPrice, TicketPass, VoucherPass dan OrderSummary dibuat custom dari token yang sama.
- Jangan menambahkan HeroUIProvider atau konfigurasi versi lama tanpa kebutuhan versi yang dipilih.
- Theme SSR dan client memakai initial state konsisten untuk menghindari flash/hydration mismatch.
- Format uang, waktu event dan expiry konsisten; countdown memakai server expiresAt.
- Uji viewport 360, 390, 768, 1024 dan 1440px sebagai baseline rekomendasi.
- Uji light/dark, keyboard, screen-reader labels, reduced motion, loading, empty, error, expired dan pending payment.
- Desain akhir dianggap tervalidasi setelah inspeksi halaman nyata; dokumen ini bukan bukti visual QA sudah dilakukan.

