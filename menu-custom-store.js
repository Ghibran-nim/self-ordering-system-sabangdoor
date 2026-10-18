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