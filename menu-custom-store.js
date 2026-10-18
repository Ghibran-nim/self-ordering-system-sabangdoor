/**
 * - File: menu-custom-store.js (Versi Backend Express.js & PostgreSQL)
 * - Penyimpanan & helper bersama untuk "Menu Tambahan"
 */

const API_BASE_URL = 'http://localhost:5000/api';
const DEFAULT_MENU_IMG = 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80';

// Kategori bawaan -> id section yang sudah ada di index.html
const KATEGORI_BAWAAN = {
    'Dimsum Mentai': 'section-mentai',
    'Dimsum aja': 'section-dimsum-aja',
    'Bakpao': 'section-bakpao'
};

// Cache lokal untuk menyimpan data menu custom sementara di browser
let cachedCustomMenus = [];

// Ambil data menu custom dari Backend PostgreSQL
async function getCustomMenusFromSupabase() { // nama fungsi dipertahankan agar kompatibel
    try {
        const response = await fetch(`${API_BASE_URL}/menu-custom`);
        if (!response.ok) throw new Error('Gagal mengambil data menu custom');
        const data = await response.json();

        // Konversi format JSONB dari database kembali ke array objek JS jika diperlukan
        cachedCustomMenus = data.map(item => ({
            ...item,
            img: item.img_url || item.img || DEFAULT_MENU_IMG,
            ukuran: typeof item.ukuran === 'string' ? JSON.parse(item.ukuran) : (item.ukuran || []),
            addon: typeof item.addon === 'string' ? JSON.parse(item.addon) : (item.addon || [])
        }));

        return cachedCustomMenus;
    } catch (e) {
        console.error("Error mengambil menu custom:", e);
        return cachedCustomMenus;
    }
}

// Fungsi sinkronus cadangan yang mengembalikan data dari cache lokal
function getCustomMenus() {
    return cachedCustomMenus;
}

// Simpan atau Perbarui Menu Custom ke Backend PostgreSQL
async function saveCustomMenuToSupabase(menuObj) {
    try {
        const payload = {
            id: menuObj.id,
            nama: menuObj.nama,
            kategori: menuObj.kategori,
            deskripsi: menuObj.deskripsi,
            img_url: menuObj.img || menuObj.img_url || DEFAULT_MENU_IMG,
            gratis: menuObj.gratis || '',
            ukuran: menuObj.ukuran || [],
            addon: menuObj.addon || [],
            habis: menuObj.habis || false
        };

        const response = await fetch(`${API_BASE_URL}/menu-custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Gagal menyimpan menu ke database');

        // Refresh cache lokal
        await getCustomMenusFromSupabase();
        return true;
    } catch (e) {
        console.error("Gagal menyimpan menu:", e);
        alert('Gagal menyimpan menu ke database PostgreSQL lokal.');
        return false;
    }
}

// Hapus Menu Custom dari Backend PostgreSQL
async function deleteCustomMenuFromSupabase(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/menu-custom/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Gagal menghapus menu dari database');

        // Refresh cache lokal
        await getCustomMenusFromSupabase();
        return true;
    } catch (e) {
        console.error("Gagal menghapus menu:", e);
        alert('Gagal menghapus menu dari database.');
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
}//zero