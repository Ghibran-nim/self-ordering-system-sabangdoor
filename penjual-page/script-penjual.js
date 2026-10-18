const QRIS_STORAGE_KEY = "sabangdor_custom_qris";
const API_URL = "http://localhost:5000/api";

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
let pesananLokal = [];

// ==========================================
// AUTENTIKASI LOKAL
// ==========================================
function checkAuth() {
    const session = localStorage.getItem('pegawai_session');
    if (!session) {
        window.location.href = '../login-pegawai.html';
    }
}

function handleLogout() {
    localStorage.removeItem('pegawai_session');
    window.location.href = '../login-pegawai.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

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

    // Interval rutin 3 detik untuk fetch data pesanan dari Express.js
    setInterval(() => {
        checkAndRenderAuto();
    }, 3000);
});

// ==========================================
// FETCH PESANAN DARI BACKEND LOKAL
// ==========================================
async function fetchPesananDariBackend() {
    try {
        const response = await fetch(`${API_URL}/orders`);
        if (!response.ok) throw new Error('Gagal mengambil data pesanan');
        const data = await response.json();

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
                    nama: item.menus ? item.menus.nama_dimsum : 'Menu Dimsum',
                    qty: item.jumlah,
                    totalHargaItem: Number(item.subtotal) || 0
                })) : []
            };
        });
    } catch (err) {
        console.error("Error Fetching Backend:", err);
        return [];
    }
}

async function checkAndRenderAuto() {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
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
    pesananLokal = await fetchPesananDariBackend();

    let semuaPesanan = pesananLokal;
    let riwayat = pesananLokal.filter(p => p.statusPesananDb === 'selesai');

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
    else if (currentSec === 'menu') { if (force) renderMenuTambahan(); }
    else if (currentSec === 'riwayat') renderRiwayat(riwayat);
}

// 1. MANAJEMEN STOK & QRIS
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
        const imgUrl = item.img || DEFAULT_MENU_IMG;

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

function getItemSubtotal(i) {
    if (i.totalHargaItem && !isNaN(i.totalHargaItem)) return i.totalHargaItem;
    if (i.hargaSatuan && !isNaN(i.hargaSatuan)) return i.hargaSatuan * (i.qty || 1);
    if (i.harga && !isNaN(i.harga)) return i.harga * (i.qty || 1);
    return 0;
}

// 2. VERIFIKASI PEMBAYARAN
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
            return `
                <li class="order-item-row">
                    <div><span><b>${i.qty || 1}x</b> ${i.nama}</span></div>
                    <b>Rp${itemHarga.toLocaleString('id-ID')}</b>
                </li>
            `;
        }).join('');

        const isTunais = order.metodeBayar === 'CASH' || order.metodeBayar === 'TUNAI';

        html += `
            <div class="order-card-merchant">
                <div class="order-head">
                    <span class="order-id-txt">#${order.idOrder} (${order.namaPelanggan})</span>
                    <span class="order-badge-pay ${isTunais ? 'tag-cash' : 'tag-qris'}">${order.metodeBayar}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                    ${order.waktu} WIB | Total Tagihan: <b style="color:var(--primary-red); font-size:0.85rem;">${order.totalHargaFormatted}</b>
                </div>
                <ul class="order-item-list">${itemList}</ul>
                <div class="btn-group">
                    <button class="btn-primary-merchant" onclick="konfirmasiPembayaran(${order.db_id_order})">
                        ${isTunais ? 'Terima Tunai & Kirim Dapur' : 'Verifikasi QRIS & Kirim Dapur'}
                    </button>
                    <button class="btn-outline-merchant" onclick="cetakStrukLangsungById(${order.db_id_order})">🖨️ Struk</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function konfirmasiPembayaran(dbIdOrder) {
    try {
        const response = await fetch(`${API_URL}/orders/${dbIdOrder}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_pembayaran: 'lunas', status_pesanan: 'disiapkan' })
        });

        if (!response.ok) throw new Error('Gagal memperbarui status pembayaran');
        await renderCurrentSection(true);
    } catch (err) {
        console.error("Error Konfirmasi Pembayaran:", err);
        alert("Terjadi error: " + err.message);
    }
}

// 3. DISPLAY KITCHEN (DAPUR)
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
        let itemList = order.items ? order.items.map(i => `<li><b>${i.qty || 1}x ${i.nama}</b></li>`).join('') : '';

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
    try {
        const response = await fetch(`${API_URL}/orders/${dbIdOrder}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_pembayaran: 'lunas', status_pesanan: 'selesai' })
        });

        if (!response.ok) throw new Error('Gagal memperbarui status selesai');
        await renderCurrentSection(true);
    } catch (err) {
        console.error("Error Dapur Selesai:", err);
        alert("Terjadi error: " + err.message);
    }
}

// 4. RIWAYAT TRANSAKSI
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
                    <div style="font-weight:800; font-size:0.85rem;">#${item.idOrder} (${item.namaPelanggan} • ${item.metodeBayar})</div>
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

// 5. CETAK STRUK
function cetakStrukLangsungById(dbIdOrder) {
    const order = pesananLokal.find(p => p.db_id_order === dbIdOrder);
    if (order) cetakStrukLangsung(order);
}

function cetakStrukLangsung(order) {
    const printWindow = window.open('', '', 'width=320,height=600');
    if (!printWindow) {
        alert("Pop-up diblokir browser!");
        return;
    }

    const itemsHtml = order.items.map(i => `
        <tr>
            <td style="padding:2px 0;">${i.qty}x ${i.nama}</td>
            <td style="text-align:right; vertical-align:top;">Rp${getItemSubtotal(i).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Struk #${order.idOrder}</title></head>
        <body style="font-family:monospace; width:48mm; font-size:11px;">
            <div style="text-align:center;"><strong>SABANGDOR</strong><br><span>Outlet Ambil Sendiri</span></div>
            <hr>
            <div>No: #${order.idOrder}<br>Nama: ${order.namaPelanggan}<br>Bayar: ${order.metodeBayar}</div>
            <hr>
            <table style="width:100%;"><tbody>${itemsHtml}</tbody></table>
            <hr>
            <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>${order.totalHargaFormatted}</span></div>
            <script>window.onload = function() { window.print(); setTimeout(window.close, 500); }</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// 6. MENU TAMBAHAN
function renderMenuTambahan() {
    // Fungsi render menu tambahan berjalan secara lokal/backend
    console.log("Render Menu Tambahan siap.");
} //zero