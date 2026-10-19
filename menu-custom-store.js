/**
 * File: menu-custom-store.js
 * Penyimpanan & helper bersama untuk "Menu Tambahan" (dipakai dashboard kasir,
 * halaman menu utama pembeli, dan halaman detail menu otomatis).
 *
 * Bentuk data satu menu:
 * {
 *   id: 'custom-lx3k2a',
 *   nama: 'Siomay Ayam',
 *   kategori: 'Dimsum aja',          // kategori baru otomatis jadi tab baru di menu utama
 *   deskripsi: '...',
 *   img: 'data:image/jpeg;base64,...',
 *   gratis: 'Free Chilli Oil',       // opsional
 *   ukuran: [ { nama:'S', ket:'3 pcs', harga:13000 }, ... ],
 *   addon:  [ { nama:'Extra Mentai', harga:3000 }, ... ]
 * }
 */
const CUSTOM_MENU_KEY = 'sabangdor_custom_menus';
const MENU_STATUS_KEY = 'sabangdor_menu_status';
const DEFAULT_MENU_IMG = 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80';

// Kategori bawaan -> id section yang sudah ada di index.html
const KATEGORI_BAWAAN = {
    'Dimsum Mentai': 'section-mentai',
    'Dimsum aja': 'section-dimsum-aja',
    'Bakpao': 'section-bakpao'
};

function getCustomMenus() {
    try {
        const data = JSON.parse(localStorage.getItem(CUSTOM_MENU_KEY));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveCustomMenus(list) {
    try {
        localStorage.setItem(CUSTOM_MENU_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        alert('Penyimpanan penuh. Gunakan foto yang lebih kecil atau hapus menu lama.');
        return false;
    }
}

function escHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function rupiah(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function hargaMulai(menu) {
    const harga = (menu.ukuran || []).map(u => Number(u.harga) || 0).filter(h => h > 0);
    return harga.length ? Math.min(...harga) : 0;
}

function slugKategori(nama) {
    return String(nama).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lainnya';
}

/* =====================================================================
 * SINKRONISASI SUPABASE (tabel: menu_custom)
 * Dipanggil oleh script-penjual.js. localStorage dipakai sebagai cache
 * supaya getCustomMenus() tetap sinkron & halaman pembeli tetap cepat.
 * Jika tabel belum dibuat / koneksi gagal, data tetap tersimpan di
 * localStorage (fallback) agar fitur tidak mati.
 * ===================================================================== */
const CUSTOM_MENU_TABLE = 'menu_custom';

function _sbReady() {
    return typeof supabaseClient !== 'undefined' && supabaseClient;
}

// Baris database -> objek menu yang dipakai UI
function _rowToMenu(row) {
    return {
        id: row.id,
        nama: row.nama,
        kategori: row.kategori,
        deskripsi: row.deskripsi || '',
        img: row.img_url || DEFAULT_MENU_IMG,
        img_url: row.img_url || DEFAULT_MENU_IMG,
        gratis: row.gratis || '',
        ukuran: Array.isArray(row.ukuran) ? row.ukuran : [],
        addon: Array.isArray(row.addon) ? row.addon : [],
        habis: !!row.habis
    };
}

// Objek menu -> baris database
function _menuToRow(menu) {
    const row = {
        id: String(menu.id),
        nama: menu.nama,
        kategori: menu.kategori,
        deskripsi: menu.deskripsi || '',
        img_url: menu.img || menu.img_url || DEFAULT_MENU_IMG,
        gratis: menu.gratis || '',
        ukuran: Array.isArray(menu.ukuran) ? menu.ukuran : [],
        addon: Array.isArray(menu.addon) ? menu.addon : []
    };
    if (typeof menu.habis === 'boolean') row.habis = menu.habis;
    return row;
}

async function getCustomMenusFromSupabase() {
    if (!_sbReady()) return getCustomMenus();
    try {
        const { data, error } = await supabaseClient
            .from(CUSTOM_MENU_TABLE)
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;

        const list = (data || []).map(_rowToMenu);
        // simpan ke cache lokal tanpa alert kalau penuh
        try { localStorage.setItem(CUSTOM_MENU_KEY, JSON.stringify(list)); } catch (e) {}
        return list;
    } catch (err) {
        console.warn('Gagal ambil menu custom dari Supabase, pakai cache lokal:', err.message || err);
        return getCustomMenus();
    }
}

async function saveCustomMenuToSupabase(menu) {
    // 1) Simpan ke cache lokal dulu
    const list = getCustomMenus();
    const idx = list.findIndex(m => String(m.id) === String(menu.id));
    const lokal = { ...menu, img_url: menu.img || menu.img_url };
    if (idx >= 0) list[idx] = lokal; else list.push(lokal);
    const okLokal = saveCustomMenus(list);
    if (!okLokal) return false;

    // 2) Kirim ke Supabase
    if (!_sbReady()) return true; // mode lokal saja
    try {
        const { error } = await supabaseClient
            .from(CUSTOM_MENU_TABLE)
            .upsert(_menuToRow(menu), { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Gagal simpan ke Supabase (tersimpan lokal saja):', err.message || err);
        alert('Menu tersimpan di perangkat ini, tapi gagal sinkron ke database: ' +
              (err.message || err) + '\nCek tabel menu_custom dan RLS policy-nya (insert/update/delete).');
        return true;
    }
}

async function deleteCustomMenuFromSupabase(menuId) {
    // hapus di cache lokal
    saveCustomMenus(getCustomMenus().filter(m => String(m.id) !== String(menuId)));

    if (!_sbReady()) return true;
    try {
        const { error } = await supabaseClient
            .from(CUSTOM_MENU_TABLE)
            .delete()
            .eq('id', String(menuId));
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Gagal hapus di Supabase:', err.message || err);
        return false;
    }
}