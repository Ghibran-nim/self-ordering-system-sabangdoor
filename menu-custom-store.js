/**
 * File: menu-custom-store.js
 * Penyimpanan & helper bersama untuk "Menu Tambahan"
 * Terhubung langsung ke Supabase (tabel `menu_custom`) & localStorage.
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

// ==========================================
// 1. HELPER LOKAL & FORMATTING
// ==========================================

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

// ==========================================
// 2. INTEGRASI SUPABASE (CLOUD SYNC)
// ==========================================

/**
 * Mengambil seluruh menu custom dari tabel `menu_custom` Supabase.
 * Sekaligus menyinkronkan data ke localStorage sebagai fallback.
 */
async function getCustomMenusFromSupabase() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('supabaseClient belum diinisialisasi. Menggunakan data localStorage.');
            return getCustomMenus();
        }

        const { data, error } = await supabaseClient
            .from('menu_custom')
            .select('*');

        if (error) {
            console.error('Gagal mengambil menu custom dari Supabase:', error.message);
            return getCustomMenus();
        }

        if (data) {
            // Petakan kolom `img_url` kembali ke atribut `img` untuk kompatibilitas frontend
            const formattedData = data.map(item => ({
                ...item,
                img: item.img_url || item.img || DEFAULT_MENU_IMG
            }));

            localStorage.setItem(CUSTOM_MENU_KEY, JSON.stringify(formattedData));
            return formattedData;
        }

        return [];
    } catch (err) {
        console.error('Error koneksi Supabase:', err);
        return getCustomMenus();
    }
}

/**
 * Menyimpan/memperbarui satu menu custom ke database Supabase (`menu_custom`)
 * dan menyinkronkannya ke localStorage.
 */
async function saveCustomMenuToSupabase(menuData) {
    try {
        if (typeof supabaseClient === 'undefined') {
            alert('Koneksi database (Supabase) belum siap.');
            return false;
        }

        // Susun payload sesuai dengan nama kolom pada tabel PostgreSQL/Supabase
        const payload = {
            id: menuData.id || ('custom-' + Math.random().toString(36).substring(2, 9)),
            nama: menuData.nama,
            kategori: menuData.kategori,
            deskripsi: menuData.deskripsi || '',
            img_url: menuData.img || menuData.img_url || '',
            gratis: menuData.gratis || '',
            ukuran: menuData.ukuran || [],
            addon: menuData.addon || [],
            habis: menuData.habis || false
        };

        const { data, error } = await supabaseClient
            .from('menu_custom')
            .upsert([payload])
            .select();

        if (error) {
            console.error('Error Simpan ke Supabase:', error.message);
            alert('Gagal menyimpan ke database Supabase: ' + error.message);
            return false;
        }

        // Perbarui cache di localStorage lokal
        let listLokal = getCustomMenus();
        const formattedMenu = { ...payload, img: payload.img_url };
        const index = listLokal.findIndex(m => m.id === payload.id);

        if (index >= 0) {
            listLokal[index] = formattedMenu;
        } else {
            listLokal.push(formattedMenu);
        }

        saveCustomMenus(listLokal);
        return true;

    } catch (e) {
        console.error('Exception saat menyimpan menu custom:', e);
        alert('Terjadi kesalahan sistem saat menyimpan ke database.');
        return false;
    }
}

/**
 * Menghapus menu custom dari Supabase & localStorage berdasarkan ID.
 */
async function deleteCustomMenuFromSupabase(menuId) {
    try {
        if (typeof supabaseClient !== 'undefined') {
            const { error } = await supabaseClient
                .from('menu_custom')
                .delete()
                .eq('id', menuId);

            if (error) {
                console.error('Gagal menghapus dari Supabase:', error.message);
            }
        }

        // Hapus dari localStorage lokal
        let listLokal = getCustomMenus().filter(m => m.id !== menuId);
        saveCustomMenus(listLokal);
        return true;
    } catch (e) {
        console.error('Exception saat menghapus menu custom:', e);
        return false;
    }
}