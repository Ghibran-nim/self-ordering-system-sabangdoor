const QRIS_STORAGE_KEY = "sabangdor_custom_qris";

const masterMenuSabangdor = [
    { id: 'mentai-cheese', nama: 'Mentai Cheese', harga: 15000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-tanuki', nama: 'Mentai Tanuki', harga: 15000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-ori', nama: 'Mentai Ori', harga: 13000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-mix', nama: 'Mentai Mix', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'dimsum-aja', nama: 'Dimsum aja', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'bakpao', nama: 'Bakpao', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' }
];

let currentSec = 'dashboard';
let activeKanbanFilter = 'proses-masak';
let pesananSupabase = [];

// ==========================================
// AUTENTIKASI SUPABASE & INITIALIZATION
// ==========================================
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = 'login-pegawai.html';
        }
    } catch (err) {
        console.error("Gagal memeriksa autentikasi:", err);
        window.location.href = 'login-pegawai.html';
    }
}

async function handleLogout() {
    try {
        if (typeof supabaseClient !== 'undefined') {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('pegawai_session');
        window.location.href = 'login-pegawai.html';
    } catch (err) {
        console.error('Logout error:', err);
        window.location.href = 'login-pegawai.html';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabaseClient !== 'undefined') {
        console.log("Supabase URL yang dipakai dashboard:", supabaseClient.supabaseUrl);
    } else {
        console.error("supabaseClient tidak ditemukan! Cek file config Supabase.");
    }

    checkAuth();

    if (typeof getCustomMenusFromSupabase === 'function') {
        await getCustomMenusFromSupabase();
    }

    let savedMenu = JSON.parse(localStorage.getItem('sabangdor_menu_status'));
    if (!savedMenu) {
        localStorage.setItem('sabangdor_menu_status', JSON.stringify(masterMenuSabangdor));
    } else {
        const belumAda = masterMenuSabangdor.filter(m => !savedMenu.some(s => s.id === m.id));
        if (belumAda.length) {
            localStorage.setItem('sabangdor_menu_status', JSON.stringify(savedMenu.concat(belumAda)));
        }
    }

    navigate('dashboard', document.querySelectorAll('.tab-item')[0]);

    setInterval(() => {
        checkAndRenderAuto();
    }, 3000);
});

async function fetchPesananDariSupabase() {
    if (typeof supabaseClient === 'undefined') return [];

    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select(`
                id_order,
                nomor_antrean,
                nama_pembeli,
                tipe_pembayaran,
                status_pembayaran,
                status_pesanan,
                total_harga,
                created_at,
                order_items (
                    id_detail,
                    nama_item,
                    varian,
                    catatan,
                    jumlah,
                    subtotal,
                    harga_satuan
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Gagal mengambil data pesanan dari Supabase:", error.message);
            return [];
        }

        return data.map(order => {
            let statusLokal = 'Menunggu Tunai';
            if (order.status_pembayaran === 'lunas' && order.status_pesanan !== 'selesai') {
                statusLokal = 'Proses Masak';
            } else if (order.status_pesanan === 'selesai') {
                statusLokal = 'Selesai & Disajikan';
            }

            return {
                db_id_order: order.id_order,
                idOrder: `ANT-${String(order.nomor_antrean).padStart(2, '0')}`,
                nomorAntrean: order.nomor_antrean,
                namaPelanggan: order.nama_pembeli,
                metodeBayar: order.tipe_pembayaran ? order.tipe_pembayaran.toUpperCase() : 'TUNAI',
                totalHarga: Number(order.total_harga) || 0,
                totalHargaFormatted: `Rp${(Number(order.total_harga) || 0).toLocaleString('id-ID')}`,
                status: statusLokal,
                statusPembayaranDb: order.status_pembayaran,
                statusPesananDb: order.status_pesanan,
                waktu: new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                tanggal: new Date(order.created_at).toLocaleDateString('id-ID'),
                items: order.order_items ? order.order_items.map(item => ({
                    nama: item.nama_item || 'Menu Dimsum',
                    varian: item.varian || '',
                    catatan: item.catatan || '',
                    qty: item.jumlah,
                    hargaSatuan: Number(item.harga_satuan) || 0,
                    totalHargaItem: Number(item.subtotal) || 0
                })) : []
            };
        });

    } catch (err) {
        console.error("Error Fetching Supabase:", err);
        return [];
    }
}

async function checkAndRenderAuto() {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return;
    }
    await renderCurrentSection();
}

function navigate(secKey, el) {
    currentSec = secKey;

    document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const secEl = document.getElementById(`sec-${secKey}`);
    if (secEl) secEl.classList.add('active');

    const titleMap = {
        'dashboard': { t: 'Manajemen Stok & QRIS', s: 'Atur Ketersediaan Menu & Gambar QRIS Toko' },
        'pembayaran': { t: 'Verifikasi Pembayaran', s: 'Konfirmasi pembayaran QRIS & Tunai dari pembeli' },
        'pantau': { t: 'Display Kitchen (Dapur)', s: 'Kelola antrian proses masak hingga selesai' },
        'menu': { t: 'Menu Tambahan', s: 'Tambah menu baru tanpa perlu membuat halaman HTML' },
        'riwayat': { t: 'Riwayat Transaksi', s: 'Arsip transaksi selesai & total omzet harian' }
    };

    if (titleMap[secKey]) {
        document.getElementById('page-title').innerText = titleMap[secKey].t;
        document.getElementById('page-subtitle').innerText = titleMap[secKey].s;
    }

    renderCurrentSection(true);
}

async function renderCurrentSection(force = false) {
    pesananSupabase = await fetchPesananDariSupabase();

    let semuaPesanan = pesananSupabase;
    let riwayat = pesananSupabase.filter(p => p.statusPesananDb === 'selesai');

    let pendingPay = semuaPesanan.filter(p => p.statusPembayaranDb === 'pending').length;
    const badgeEl = document.getElementById('badge-notif-bayar');
    if (badgeEl) {
        if (pendingPay > 0) {
            badgeEl.style.display = 'inline-block';
            badgeEl.innerText = pendingPay;
        } else {
            badgeEl.style.display = 'none';
        }
    }

    if (currentSec === 'dashboard') renderStokMenu();
    else if (currentSec === 'pembayaran') renderPembayaran(semuaPesanan, force);
    else if (currentSec === 'pantau') renderKitchenDisplay(semuaPesanan, riwayat);
    else if (currentSec === 'menu') {
        if (typeof getCustomMenusFromSupabase === 'function') {
            await getCustomMenusFromSupabase();
        }
        renderMenuTambahan();
    }
    else if (currentSec === 'riwayat') renderRiwayat(riwayat);
}

// 1. MANAJEMEN STOK & UPLOAD QRIS
function renderStokMenu() {
    const grid = document.getElementById('grid-stok-menu');
    if (!grid) return;
    let menuList = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;
    let customQrisImg = localStorage.getItem(QRIS_STORAGE_KEY);

    let html = `
        <div class="card">
            <div class="card-title">📷 Setting QRIS Outlet</div>
            <div class="card-sub">Unggah gambar QRIS untuk halaman checkout pembeli</div>
            
            <div class="upload-wrapper">
                <button type="button" class="btn-upload-custom" onclick="document.getElementById('inputFileQris').click()">
                    ➕ Pilih Gambar QRIS
                </button>
                <input type="file" id="inputFileQris" accept="image/*" style="display:none;">
            </div>

            ${customQrisImg ? `
                <div class="qris-preview-container">
                    <span style="font-size:11px; font-weight:800; color:#10B981;">✓ Gambar QRIS Aktif</span><br>
                    <img src="${customQrisImg}" class="qris-preview-img" alt="QRIS Toko">
                </div>
            ` : ''}
        </div>
        <div class="card-title" style="margin-top:10px;">Daftar Stok Menu</div>
    `;

    menuList.forEach((item, index) => {
        const isHabis = item.status === 'habis';
        const imgUrl = item.img || 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80';

        html += `
            <div class="stok-card">
                <div class="stok-left">
                    <img src="${imgUrl}" class="stok-thumb" alt="${item.nama}">
                    <span class="stok-name">${item.nama}</span>
                </div>
                <button class="btn-toggle-stok ${isHabis ? 'empty' : 'ready'}" onclick="toggleStok(${index})">
                    ${isHabis ? '🔴 HABIS' : '🟢 TERSEDIA'}
                </button>
            </div>
        `;
    });

    // Menu tambahan (custom) ikut tampil di daftar stok
    const customList = typeof getCustomMenus === 'function' ? getCustomMenus() : [];
    customList.forEach(item => {
        const isHabis = !!item.habis;
        const imgUrl = item.img || item.img_url || DEFAULT_MENU_IMG;
        html += `
            <div class="stok-card">
                <div class="stok-left">
                    <img src="${escHtml(imgUrl)}" class="stok-thumb" alt="${escHtml(item.nama)}">
                    <span class="stok-name">${escHtml(item.nama)}</span>
                </div>
                <button class="btn-toggle-stok ${isHabis ? 'empty' : 'ready'}" data-id="${escHtml(item.id)}" onclick="toggleStokCustom(this.dataset.id)">
                    ${isHabis ? '🔴 HABIS' : '🟢 TERSEDIA'}
                </button>
            </div>
        `;
    });

    grid.innerHTML = html;

    const fileInput = document.getElementById("inputFileQris");
    if (fileInput) {
        fileInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (evt) {
                    localStorage.setItem(QRIS_STORAGE_KEY, evt.target.result);
                    renderStokMenu();
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function toggleStok(index) {
    let menuList = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;
    menuList[index].status = menuList[index].status === 'tersedia' ? 'habis' : 'tersedia';
    localStorage.setItem('sabangdor_menu_status', JSON.stringify(menuList));
    renderStokMenu();
}

async function toggleStokCustom(menuId) {
    const m = getCustomMenus().find(x => String(x.id) === String(menuId));
    if (!m) return;
    await saveCustomMenuToSupabase({ ...m, habis: !m.habis });
    renderStokMenu();
}

function getItemSubtotal(i) {
    if (i.totalHargaItem && !isNaN(i.totalHargaItem) && i.totalHargaItem > 0) return i.totalHargaItem;
    if (i.hargaSatuan && !isNaN(i.hargaSatuan) && i.hargaSatuan > 0) return i.hargaSatuan * (i.qty || 1);
    if (i.harga && !isNaN(i.harga) && i.harga > 0) return i.harga * (i.qty || 1);
    return 0;
}

// 2. VERIFIKASI PEMBAYARAN & UPDATE SUPABASE
function renderPembayaran(pesananList, force = false) {
    const container = document.getElementById('container-pembayaran');
    if (!container) return;

    let pending = pesananList.filter(p => p.statusPembayaranDb === 'pending');

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada pembayaran menunggu verifikasi.</div>`;
        return;
    }

    let html = '';
    pending.forEach((order) => {
        let itemList = order.items.map(i => {
            const itemHarga = getItemSubtotal(i);
            const varianTxt = i.varian ? ` <small style="color:var(--text-muted);">(${i.varian})</small>` : '';
            const catatanTxt = i.catatan ? `<div class="item-catatan">Catatan: "${i.catatan}"</div>` : '';

            return `
                <li class="order-item-row">
                    <div>
                        <span><b>${i.qty || 1}x</b> ${i.nama}${varianTxt}</span>
                        ${catatanTxt}
                    </div>
                    <b>Rp${itemHarga.toLocaleString('id-ID')}</b>
                </li>
            `;
        }).join('');

        const isTunai = order.metodeBayar === 'CASH' || order.metodeBayar === 'TUNAI';
        const valTunai = order.uangDiterima || '';

        let kembalianHtml = '';
        if (valTunai && Number(valTunai) >= order.totalHarga) {
            const k = Number(valTunai) - order.totalHarga;
            kembalianHtml = `<div id="kembalianBox_${order.db_id_order}" class="kembalian-txt" style="color:var(--green-text);">Kembalian: Rp${k.toLocaleString('id-ID')}</div>`;
        } else if (valTunai && Number(valTunai) < order.totalHarga) {
            const kurang = order.totalHarga - Number(valTunai);
            kembalianHtml = `<div id="kembalianBox_${order.db_id_order}" class="kembalian-txt" style="color:var(--primary-red);">Kurang: Rp${kurang.toLocaleString('id-ID')}</div>`;
        } else {
            kembalianHtml = `<div id="kembalianBox_${order.db_id_order}" class="kembalian-txt" style="display:none;"></div>`;
        }

        html += `
            <div class="order-card-merchant">
                <div class="order-head">
                    <span class="order-id-txt">#${order.idOrder} (${order.namaPelanggan})</span>
                    <span class="order-badge-pay ${isTunai ? 'tag-cash' : 'tag-qris'}">${order.metodeBayar}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                    ${order.waktu} WIB | Total Tagihan: <b style="color:var(--primary-red); font-size:0.85rem;">${order.totalHargaFormatted}</b>
                </div>
                
                <ul class="order-item-list">${itemList}</ul>
                
                ${isTunai ? `
                    <div class="cash-input-box">
                        <label for="inputBayar_${order.db_id_order}">💵 Uang Diterima dari Pembeli:</label>
                        <input type="number" id="inputBayar_${order.db_id_order}" value="${valTunai}" placeholder="Ketik nominal tunai..." oninput="updateInputTunai(${order.db_id_order},${order.totalHarga}, this.value)">
                        ${kembalianHtml}
                    </div>
                ` : ''}

                <div class="btn-group">
                    <button class="btn-primary-merchant" onclick="konfirmasiPembayaran(${order.db_id_order})">
                        ${isTunai ? 'Terima Tunai & Kirim Dapur' : 'Verifikasi QRIS & Kirim Dapur'}
                    </button>
                    <button class="btn-outline-merchant" onclick="cetakStrukLangsungById(${order.db_id_order})">🖨️ Struk</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function updateInputTunai(idOrder, totalHarga, value) {
    const valNum = Number(value) || 0;
    const boxEl = document.getElementById(`kembalianBox_${idOrder}`);
    if (boxEl) {
        if (valNum >= totalHarga) {
            boxEl.style.display = 'block';
            boxEl.style.color = 'var(--green-text)';
            boxEl.innerText = `Kembalian: Rp${(valNum - totalHarga).toLocaleString('id-ID')}`;
        } else if (valNum > 0) {
            boxEl.style.display = 'block';
            boxEl.style.color = 'var(--primary-red)';
            boxEl.innerText = `Kurang: Rp${(totalHarga - valNum).toLocaleString('id-ID')}`;
        } else {
            boxEl.style.display = 'none';
        }
    }
}

async function konfirmasiPembayaran(dbIdOrder) {
    if (typeof supabaseClient === 'undefined') return;

    try {
        const numericId = parseInt(dbIdOrder, 10);

        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status_pembayaran: 'lunas',
                status_pesanan: 'disiapkan'
            })
            .eq('id_order', numericId)
            .select();

        if (error) {
            console.error("Gagal update status pembayaran:", error);
            alert("Gagal memperbarui status: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert("Update tidak mengubah data apa pun. Pastikan Anda sudah menjalankan SQL Policy UPDATE di Supabase Editor.");
            return;
        }

        await renderCurrentSection(true);

    } catch (err) {
        console.error("Gagal update status pembayaran di Supabase:", err);
        alert("Terjadi error: " + err.message);
    }
}

// 3. DISPLAY KITCHEN
function switchKitchenTab(type, evt) {
    activeKanbanFilter = type;
    document.querySelectorAll('.k-tab').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
    renderCurrentSection(true);
}

function renderKitchenDisplay(pesananList, riwayatList) {
    const container = document.getElementById('kanban-content-mobile');
    if (!container) return;

    let listProsesMasak = pesananList.filter(p => p.statusPembayaranDb === 'lunas' && p.statusPesananDb !== 'selesai');
    let listSelesai = pesananList.filter(p => p.statusPesananDb === 'selesai');

    const countProsesEl = document.getElementById('count-terkirim') || document.getElementById('count-proses-masak');
    const countSelesaiEl = document.getElementById('count-selesai');
    if (countProsesEl) countProsesEl.innerText = listProsesMasak.length;
    if (countSelesaiEl) countSelesaiEl.innerText = listSelesai.length;

    let filtered = activeKanbanFilter === 'proses-masak' ? listProsesMasak : listSelesai;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada pesanan dalam kategori ini.</div>`;
        return;
    }

    let html = '';
    filtered.forEach((order) => {
        let itemList = order.items ? order.items.map(i => {
            const varianTxt = i.varian ? ` (${i.varian})` : '';
            const catatanTxt = i.catatan ? `<div class="item-catatan">Catatan: "${i.catatan}"</div>` : '';
            return `<li style="margin-bottom:6px;"><div><b>${i.qty || 1}x ${i.nama}${varianTxt}</b>${catatanTxt}</div></li>`;
        }).join('') : '';

        html += `
            <div class="order-card-merchant">
                <div class="order-head">
                    <span class="order-id-txt">#${order.idOrder} (${order.namaPelanggan})</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${order.waktu} WIB</span>
                </div>
                <ul class="order-item-list">${itemList}</ul>
        `;

        if (activeKanbanFilter === 'proses-masak') {
            html += `<button class="btn-primary-merchant" style="background:#3B82F6;" onclick="tandaiSelesaiDapur(${order.db_id_order})">Selesai & Sajikan</button></div>`;
        } else {
            html += `<p style="font-size:0.8rem; color:var(--green-text); font-weight:800;">Status: Selesai & Disajikan</p></div>`;
        }
    });

    container.innerHTML = html;
}

async function tandaiSelesaiDapur(dbIdOrder) {
    if (typeof supabaseClient === 'undefined') return;

    try {
        const numericId = parseInt(dbIdOrder, 10);

        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status_pembayaran: 'lunas',
                status_pesanan: 'selesai'
            })
            .eq('id_order', numericId)
            .select();

        if (error) {
            console.error("Gagal update status selesai:", error);
            alert("Gagal: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert("Update tidak mengubah data apa pun.");
            return;
        }

        await renderCurrentSection(true);

    } catch (err) {
        console.error("Gagal update status selesai di Supabase:", err);
        alert("Terjadi error: " + err.message);
    }
}

// 4. RIWAYAT & OMZET
function resetFilterTanggal() {
    const inputEl = document.getElementById('filterTanggal');
    if (inputEl) inputEl.value = '';
    renderCurrentSection(true);
}

function renderRiwayat(riwayatList) {
    const banner = document.getElementById('summary-omzet-card');
    const container = document.getElementById('history-cards-container');
    const filterInput = document.getElementById('filterTanggal');
    if (!container) return;

    let selectedDate = filterInput ? filterInput.value : '';
    let formattedSelectedDate = '';
    if (selectedDate) {
        const parts = selectedDate.split('-');
        if (parts.length === 3) {
            formattedSelectedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    let filteredList = riwayatList;
    if (formattedSelectedDate) {
        filteredList = riwayatList.filter(item => item.tanggal === formattedSelectedDate);
    }

    let totalOmzet = filteredList.reduce((sum, item) => sum + (item.totalHarga || 0), 0);

    if (banner) {
        let labelOmzet = formattedSelectedDate ? `Omzet Tanggal ${formattedSelectedDate}` : 'Total Omzet Keseluruhan';
        banner.innerHTML = `
            <div class="omzet-banner">
                <p>${labelOmzet}</p>
                <h2>Rp${totalOmzet.toLocaleString('id-ID')}</h2>
            </div>
        `;
    }

    if (filteredList.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada riwayat transaksi pada tanggal ini.</div>`;
        return;
    }

    let html = '';
    filteredList.forEach((item) => {
        html += `
            <div class="order-card-merchant" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:800; font-size:0.85rem;">#${item.idOrder} (${item.namaPelanggan} - ${item.metodeBayar})</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.tanggal} ${item.waktu} WIB</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <b style="color:var(--green-text); font-size:0.85rem;">${item.totalHargaFormatted}</b>
                    <button class="btn-outline-merchant" style="padding:6px 10px; font-size:0.75rem;" onclick="cetakStrukLangsungById(${item.db_id_order})">🖨️</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 5. CETAK STRUK PRINTER THERMAL (58mm)
function cetakStrukLangsungById(dbIdOrder) {
    const order = pesananSupabase.find(p => p.db_id_order === dbIdOrder);
    if (order) {
        cetakStrukLangsung(order);
    }
}

function cetakStrukLangsung(order) {
    const printWindow = window.open('', '', 'width=320,height=600');
    if (!printWindow) {
        alert("Pop-up diblokir browser! Izinkan pop-up untuk mencetak.");
        return;
    }

    const itemsHtml = order.items.map(i => {
        const harga = getItemSubtotal(i);
        const varianTxt = i.varian ? ` (${i.varian})` : '';
        const catatanTxt = i.catatan ? `<br><small>*${i.catatan}</small>` : '';
        return `
            <tr>
                <td style="padding:2px 0;">${i.qty}x ${i.nama}${varianTxt}${catatanTxt}</td>
                <td style="text-align:right; vertical-align:top;">Rp${harga.toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Struk #${order.idOrder}</title>
            <style>
                @page { size: 58mm; margin: 0; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: 48mm;
                    margin: 0 auto;
                    padding: 8px 0;
                    font-size: 11px;
                    color: #000;
                }
                .text-center { text-align: center; }
                .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <strong style="font-size:14px;">SABANGDOR</strong><br>
                <span>Outlet Ambil Sendiri</span><br>
            </div>
            
            <div class="divider"></div>

            <div>
                <div>No: <strong>#${order.idOrder}</strong></div>
                <div>Nama: ${order.namaPelanggan}</div>
                <div>Tgl: ${order.tanggal || new Date().toLocaleDateString('id-ID')} ${order.waktu}</div>
                <div>Bayar: ${order.metodeBayar}</div>
            </div>

            <div class="divider"></div>

            <table>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="divider"></div>

            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px;">
                <span>TOTAL:</span>
                <span>${order.totalHargaFormatted}</span>
            </div>

            <div class="divider"></div>
            
            <div class="text-center" style="margin-top:8px;">
                <span>Terima Kasih!</span><br>
                <small>Selamat Menikmati</small>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// ==========================================
// 6. RENDER MENU TAMBAHAN (SABANGDOR POS)
// ==========================================
let mtEditingId = null;   // id menu yang sedang diedit (null = tambah baru)
let mtFotoData = '';      // foto terpilih (data URL); kosong = pakai gambar default
let mtMsgTimer = null;

function mtBarisUkuranHtml(u) {
    u = u || {};
    return `
        <div class="mt-row mt-ukuran-row">
            <input type="text" class="mt-input mt-u-nama" placeholder="Ukuran" value="${escHtml(u.nama || '')}">
            <input type="text" class="mt-input mt-u-porsi" placeholder="1 porsi" value="${escHtml(u.porsi || '')}">
            <input type="number" class="mt-input mt-u-harga" placeholder="Harga" min="0" inputmode="numeric" value="${u.harga ? Number(u.harga) : ''}">
            <button type="button" class="mt-btn-x" aria-label="Hapus baris" onclick="this.closest('.mt-row').remove()">✕</button>
        </div>`;
}

function mtBarisAddonHtml(a) {
    a = a || {};
    return `
        <div class="mt-row mt-addon-row">
            <input type="text" class="mt-input mt-a-nama" placeholder="Nama tambahan" value="${escHtml(a.nama || '')}">
            <input type="number" class="mt-input mt-a-harga" placeholder="Harga" min="0" inputmode="numeric" value="${a.harga ? Number(a.harga) : ''}">
            <button type="button" class="mt-btn-x" aria-label="Hapus baris" onclick="this.closest('.mt-row').remove()">✕</button>
        </div>`;
}

function mtTambahUkuran(data) {
    const el = document.getElementById('mtUkuranList');
    if (el) el.insertAdjacentHTML('beforeend', mtBarisUkuranHtml(data));
}

function mtTambahAddon(data) {
    const el = document.getElementById('mtAddonList');
    if (el) el.insertAdjacentHTML('beforeend', mtBarisAddonHtml(data));
}

function mtShowMsg(teks, tipe) {
    const el = document.getElementById('mtMsg');
    if (!el) return;
    el.textContent = teks;
    el.className = 'mt-msg show ' + (tipe || 'ok');
    clearTimeout(mtMsgTimer);
    if ((tipe || 'ok') === 'ok') {
        mtMsgTimer = setTimeout(() => { el.className = 'mt-msg'; }, 3500);
    }
}

function mtPilihFoto(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        const img = new Image();
        img.onload = function () {
            // Perkecil supaya muat di database & localStorage
            const maxSide = 600;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            mtFotoData = canvas.toDataURL('image/jpeg', 0.75);
            const prev = document.getElementById('mtFotoPreview');
            if (prev) prev.src = mtFotoData;
        };
        img.onerror = function () { mtShowMsg('File foto tidak bisa dibaca.', 'error'); };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

const MT_KATEGORI_BARU = '__kategori_baru__';
const MT_KATEGORI_BAWAAN = ['Dimsum Mentai', 'Dimsum aja', 'Bakpao'];

// Kategori bawaan + semua kategori yang pernah dipakai menu custom
function mtDaftarKategori() {
    const hasil = MT_KATEGORI_BAWAAN.slice();
    (typeof getCustomMenus === 'function' ? getCustomMenus() : []).forEach(m => {
        const k = String(m.kategori || '').trim();
        if (k && !hasil.some(x => x.toLowerCase() === k.toLowerCase())) hasil.push(k);
    });
    return hasil;
}

function mtOnKategoriChange(fokus) {
    const sel = document.getElementById('mtKategori');
    const wrap = document.getElementById('mtKategoriBaruWrap');
    if (!sel || !wrap) return;
    const baru = sel.value === MT_KATEGORI_BARU;
    wrap.style.display = baru ? 'block' : 'none';
    if (baru && fokus) {
        const inp = document.getElementById('mtKategoriBaru');
        if (inp) inp.focus();
    }
}

// Isi ulang <select> kategori. `pilih` = nilai yang dipilih (kosong = pertahankan pilihan sekarang)
function mtIsiKategori(pilih) {
    const sel = document.getElementById('mtKategori');
    if (!sel) return;

    const daftar = mtDaftarKategori();
    const sig = daftar.join('|');
    if (pilih === undefined && sel.dataset.sig === sig) return; // tidak ada perubahan

    const sekarang = pilih !== undefined ? pilih : sel.value;
    sel.innerHTML = daftar.map(k => `<option value="${escHtml(k)}">${escHtml(k)}</option>`).join('')
        + `<option value="${MT_KATEGORI_BARU}">➕ Kategori baru…</option>`;
    sel.dataset.sig = sig;

    const cocok = daftar.find(k => k.toLowerCase() === String(sekarang || '').toLowerCase());
    if (cocok) sel.value = cocok;
    else if (sekarang === MT_KATEGORI_BARU) sel.value = MT_KATEGORI_BARU;
    else sel.selectedIndex = 0;

    mtOnKategoriChange(false);
}

function mtResetForm() {
    mtEditingId = null;
    mtFotoData = '';

    const form = document.getElementById('formTambahMenuCustom');
    if (form) form.reset();
    mtIsiKategori('');

    const u = document.getElementById('mtUkuranList');
    const a = document.getElementById('mtAddonList');
    if (u) u.innerHTML = '';
    if (a) a.innerHTML = '';

    const prev = document.getElementById('mtFotoPreview');
    if (prev) prev.src = DEFAULT_MENU_IMG;

    const title = document.getElementById('mtFormTitle');
    if (title) title.textContent = '➕ Tambah Menu Baru';
    const btn = document.getElementById('btnSimpanMenuCustom');
    if (btn) btn.textContent = 'Simpan Menu';
    const batal = document.getElementById('btnBatalEditMenu');
    if (batal) batal.style.display = 'none';
}

function renderMenuTambahan() {
    let secEl = document.getElementById('sec-menu');
    if (!secEl) return;

    // Form hanya dibuat SEKALI. Auto-refresh (tiap 3 detik) cuma menyegarkan daftar di bawahnya,
    // sehingga isian form tidak ikut terhapus.
    if (!document.getElementById('formTambahMenuCustom')) {
        secEl.innerHTML = `
            <div class="card" id="mt-form-card">
                <div class="card-title" id="mtFormTitle">➕ Tambah Menu Baru</div>
                <div class="card-sub">Menu langsung tampil di halaman pembeli lengkap dengan detail menunya</div>

                <form id="formTambahMenuCustom" onsubmit="handleSimpanMenuCustom(event)" novalidate>
                    <div class="mt-field">
                        <label>Foto menu</label>
                        <div class="mt-photo">
                            <img id="mtFotoPreview" src="${DEFAULT_MENU_IMG}" alt="Foto menu">
                            <div>
                                <button type="button" class="btn-upload-custom" onclick="document.getElementById('mtFotoInput').click()">📷 Pilih Foto</button>
                                <input type="file" id="mtFotoInput" accept="image/*" style="display:none;" onchange="mtPilihFoto(this)">
                                <div class="mt-hint">Kosongkan jika belum ada foto</div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-field">
                        <label for="mtNama">Nama menu</label>
                        <input type="text" id="mtNama" class="mt-input" placeholder="Contoh: Siomay Ayam" autocomplete="off">
                    </div>

                    <div class="mt-field">
                        <label for="mtKategori">Kategori</label>
                        <select id="mtKategori" class="mt-input" onchange="mtOnKategoriChange(true)">
                            <option value="Dimsum Mentai">Dimsum Mentai</option>
                            <option value="Dimsum aja">Dimsum aja</option>
                            <option value="Bakpao">Bakpao</option>
                        </select>
                        <div id="mtKategoriBaruWrap" style="display:none; margin-top:8px;">
                            <input type="text" id="mtKategoriBaru" class="mt-input" placeholder="Nama kategori baru, contoh: Minuman" autocomplete="off">
                            <div class="mt-hint">Kategori baru otomatis muncul di daftar pilihan setelah menu disimpan.</div>
                        </div>
                    </div>

                    <div class="mt-field">
                        <label for="mtDeskripsi">Deskripsi singkat</label>
                        <textarea id="mtDeskripsi" class="mt-input" rows="2" placeholder="Contoh: Dimsum ayam lembut dengan saus spesial."></textarea>
                    </div>

                    <div class="mt-field">
                        <label>Ukuran / porsi &amp; harga</label>
                        <div class="mt-hint" style="margin:0 0 8px;">Menu satu harga? Isi satu baris saja, misalnya Reguler • 1 porsi • 10000.</div>
                        <div id="mtUkuranList"></div>
                        <button type="button" class="mt-btn-add" onclick="mtTambahUkuran()">+ Tambah ukuran</button>
                    </div>

                    <div class="mt-field">
                        <label for="mtGratis">Bonus gratis (opsional)</label>
                        <input type="text" id="mtGratis" class="mt-input" placeholder="Contoh: Free Chilli Oil" autocomplete="off">
                    </div>

                    <div class="mt-field">
                        <label>Tambahan opsional (opsional)</label>
                        <div id="mtAddonList"></div>
                        <button type="button" class="mt-btn-add" onclick="mtTambahAddon()">+ Tambah pilihan tambahan</button>
                    </div>

                    <div id="mtMsg" class="mt-msg"></div>

                    <div class="btn-group">
                        <button type="submit" id="btnSimpanMenuCustom" class="btn-primary-merchant">Simpan Menu</button>
                        <button type="button" id="btnBatalEditMenu" class="btn-outline-merchant" style="display:none;" onclick="mtResetForm()">Batal</button>
                    </div>
                </form>
            </div>

            <div class="card-title" style="margin-top:16px;">Daftar Menu Custom Terpasang</div>
            <div id="listMenuCustom"></div>
        `;
    }

    // Pilihan kategori ikut diperbarui (tidak dilakukan saat dropdown sedang dipakai)
    const selKat = document.getElementById('mtKategori');
    if (selKat && document.activeElement !== selKat) mtIsiKategori();

    // Hanya bagian daftar yang di-refresh
    const listEl = document.getElementById('listMenuCustom');
    if (!listEl) return;

    let customList = typeof getCustomMenus === 'function' ? getCustomMenus() : [];

    if (customList.length === 0) {
        listEl.innerHTML = `<div class="empty-info" style="margin-top:12px;">Belum ada menu custom tambahan.</div>`;
        return;
    }

    listEl.innerHTML = customList.map(item => {
        const ukuran = Array.isArray(item.ukuran) ? item.ukuran : [];
        const hargaMin = ukuran.length ? hargaMulai(item) : (item.harga || 0);
        const infoUkuran = ukuran.length > 1 ? ` • ${ukuran.length} ukuran` : '';
        const infoAddon = Array.isArray(item.addon) && item.addon.length ? ` • ${item.addon.length} tambahan` : '';
        const imgSrc = item.img || item.img_url || DEFAULT_MENU_IMG;
        const idAttr = escHtml(item.id);
        return `
            <div class="stok-card" style="margin-top:10px;">
                <div class="stok-left">
                    <img src="${escHtml(imgSrc)}" class="stok-thumb" alt="${escHtml(item.nama)}">
                    <div class="mt-info">
                        <div class="stok-name"><b>${escHtml(item.nama)}</b></div>
                        <div class="mt-meta">${escHtml(item.kategori || 'Umum')} • mulai ${rupiah(hargaMin)}${infoUkuran}${infoAddon}</div>
                    </div>
                </div>
                <div class="mt-actions">
                    <button type="button" class="mt-btn-small" data-id="${idAttr}" onclick="mulaiEditMenuCustom(this.dataset.id)">Edit</button>
                    <button type="button" class="mt-btn-small danger" data-id="${idAttr}" onclick="hapusMenuCustom(this.dataset.id)">Hapus</button>
                </div>
            </div>
        `;
    }).join('');
}

function mulaiEditMenuCustom(menuId) {
    const m = getCustomMenus().find(x => String(x.id) === String(menuId));
    if (!m) return;

    mtResetForm();
    mtEditingId = m.id;

    const foto = m.img_url || m.img || '';
    mtFotoData = foto === DEFAULT_MENU_IMG ? '' : foto;

    document.getElementById('mtNama').value = m.nama || '';
    mtIsiKategori(m.kategori || 'Dimsum Mentai');
    document.getElementById('mtDeskripsi').value = m.deskripsi || '';
    document.getElementById('mtGratis').value = m.gratis || '';
    document.getElementById('mtFotoPreview').src = foto || DEFAULT_MENU_IMG;

    (Array.isArray(m.ukuran) ? m.ukuran : []).forEach(u => mtTambahUkuran(u));
    (Array.isArray(m.addon) ? m.addon : []).forEach(a => mtTambahAddon(a));

    document.getElementById('mtFormTitle').textContent = '✏️ Edit Menu';
    document.getElementById('btnSimpanMenuCustom').textContent = 'Simpan Perubahan';
    document.getElementById('btnBatalEditMenu').style.display = '';

    const card = document.getElementById('mt-form-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleSimpanMenuCustom(e) {
    e.preventDefault();

    const nama = document.getElementById('mtNama').value.trim();
    let kategori = document.getElementById('mtKategori').value;
    const deskripsi = document.getElementById('mtDeskripsi').value.trim();
    const gratis = document.getElementById('mtGratis').value.trim();

    if (!nama) {
        mtShowMsg('Nama menu wajib diisi.', 'error');
        return;
    }

    if (kategori === MT_KATEGORI_BARU) {
        const baru = document.getElementById('mtKategoriBaru').value.trim();
        if (!baru) {
            mtShowMsg('Nama kategori baru wajib diisi.', 'error');
            return;
        }
        // Kalau namanya sama dengan kategori yang sudah ada (tanpa beda huruf besar/kecil), pakai yang lama
        kategori = mtDaftarKategori().find(k => k.toLowerCase() === baru.toLowerCase()) || baru;
    }

    // Baca baris ukuran / porsi & harga
    const ukuran = [];
    let ukuranError = false;
    document.querySelectorAll('#mtUkuranList .mt-ukuran-row').forEach(row => {
        const uNama = row.querySelector('.mt-u-nama').value.trim();
        const uPorsi = row.querySelector('.mt-u-porsi').value.trim();
        const uHarga = Number(row.querySelector('.mt-u-harga').value) || 0;
        if (!uNama && !uPorsi && !uHarga) return; // baris kosong diabaikan
        if (uHarga <= 0) { ukuranError = true; return; }
        ukuran.push({ nama: uNama || 'Reguler', porsi: uPorsi, harga: uHarga });
    });

    if (ukuranError) {
        mtShowMsg('Harga pada setiap baris ukuran harus lebih dari 0.', 'error');
        return;
    }
    if (ukuran.length === 0) {
        mtShowMsg('Tambahkan minimal satu ukuran/porsi beserta harganya.', 'error');
        return;
    }

    // Baca baris tambahan opsional
    const addon = [];
    document.querySelectorAll('#mtAddonList .mt-addon-row').forEach(row => {
        const aNama = row.querySelector('.mt-a-nama').value.trim();
        const aHarga = Number(row.querySelector('.mt-a-harga').value) || 0;
        if (aNama) addon.push({ nama: aNama, harga: aHarga });
    });

    const lama = mtEditingId ? getCustomMenus().find(x => String(x.id) === String(mtEditingId)) : null;

    const menuData = {
        ...(lama || {}),
        id: mtEditingId || ('custom-' + Date.now()),
        nama: nama,
        kategori: kategori,
        deskripsi: deskripsi,
        img: mtFotoData || DEFAULT_MENU_IMG,
        gratis: gratis,
        ukuran: ukuran,
        addon: addon
    };

    const btn = document.getElementById('btnSimpanMenuCustom');
    if (btn) btn.disabled = true;

    try {
        if (typeof saveCustomMenuToSupabase === 'function') {
            const ok = await saveCustomMenuToSupabase(menuData);
            if (ok) {
                const wasEdit = !!mtEditingId;
                mtResetForm();
                mtShowMsg(wasEdit ? 'Perubahan menu berhasil disimpan!' : 'Menu berhasil ditambahkan!', 'ok');
                renderMenuTambahan();
            }
        } else {
            mtShowMsg('Fungsi saveCustomMenuToSupabase tidak ditemukan.', 'error');
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function hapusMenuCustom(menuId) {
    if (!confirm("Apakah Anda yakin ingin menghapus menu ini?")) return;

    if (typeof deleteCustomMenuFromSupabase === 'function') {
        const ok = await deleteCustomMenuFromSupabase(menuId);
        if (ok) {
            if (String(mtEditingId) === String(menuId)) mtResetForm();
            mtShowMsg('Menu berhasil dihapus.', 'ok');
            renderMenuTambahan();
        } else {
            mtShowMsg('Gagal menghapus menu dari database. Cek policy DELETE di Supabase.', 'error');
        }
    }
}