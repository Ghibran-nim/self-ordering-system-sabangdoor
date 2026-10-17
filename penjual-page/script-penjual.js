/**
 * File: js/script-penjual.js
 * Perbaikan: Menampilkan varian, catatan pelanggan, dan memperbaiki kalkulasi harga item (mencegah RpNaN).
 */

const QRIS_STORAGE_KEY = "sabangdor_custom_qris";

const masterMenuSabangdor = [
    { id: 'mentai-cheese', nama: 'Mentai Cheese', harga: 15000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-tanuki', nama: 'Mentai Tanuki', harga: 15000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-ori', nama: 'Mentai Ori', harga: 13000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'mentai-mix', nama: 'Mentai Mix', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'dimsum-aja', nama: 'Dimsum aja', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' },
    { id: 'bakpao', nama: 'Bakpao', harga: 26000, status: 'tersedia', img: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80' }
];

document.addEventListener('DOMContentLoaded', () => {
    let savedMenu = JSON.parse(localStorage.getItem('sabangdor_menu_status'));
    if (!savedMenu || savedMenu.length !== masterMenuSabangdor.length) {
        localStorage.setItem('sabangdor_menu_status', JSON.stringify(masterMenuSabangdor));
    }

    navigate('dashboard', document.querySelector('.tab-item'));
    setInterval(renderCurrentSection, 2000);
});

let currentSec = 'dashboard';
let activeKanbanFilter = 'proses-masak';

function navigate(secKey, el) {
    currentSec = secKey;

    document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${secKey}`).classList.add('active');

    const titleMap = {
        'dashboard': { t: 'Manajemen Stok & QRIS', s: 'Atur Ketersediaan Menu & Gambar QRIS Toko' },
        'pembayaran': { t: 'Verifikasi Pembayaran', s: 'Konfirmasi pembayaran QRIS & Tunai dari pembeli' },
        'pantau': { t: 'Display Kitchen (Dapur)', s: 'Kelola antrian proses masak hingga selesai' },
        'riwayat': { t: 'Riwayat Transaksi', s: 'Arsip transaksi selesai & total omzet harian' }
    };

    document.getElementById('page-title').innerText = titleMap[secKey].t;
    document.getElementById('page-subtitle').innerText = titleMap[secKey].s;

    renderCurrentSection();
}

function renderCurrentSection() {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    let riwayat = JSON.parse(localStorage.getItem('sabangdor_riwayat_transaksi')) || [];

    let pendingPay = semuaPesanan.filter(p => p.status === 'Menunggu Tunai' || p.status.includes('Lunas QRIS')).length;
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
    else if (currentSec === 'pembayaran') renderPembayaran(semuaPesanan);
    else if (currentSec === 'pantau') renderKitchenDisplay(semuaPesanan, riwayat);
    else if (currentSec === 'riwayat') renderRiwayat(riwayat);
}

// 1. MANAJEMEN STOK & UPLOAD QRIS
function renderStokMenu() {
    const grid = document.getElementById('grid-stok-menu');
    if (!grid) return;
    let menuList = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;
    let customQrisImg = localStorage.getItem(QRIS_STORAGE_KEY);

    let html = `
        <div class="card" style="margin-bottom:10px; background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:12px;">
            <h3 style="font-size:13px; font-weight:700; margin-bottom:4px; color:#1E293B;">📷 Setting Gambar QRIS Toko</h3>
            <p style="font-size:10.5px; color:#64748B; margin-bottom:8px;">Unggah gambar QRIS outlet Anda agar otomatis muncul di halaman checkout pembeli.</p>
            <input type="file" id="inputFileQris" accept="image/*" style="font-size:11px; margin-bottom:6px;">
            ${customQrisImg ? `
                <div style="margin-top:6px;">
                    <span style="font-size:10px; font-weight:700; color:#10B981;">✓ Gambar QRIS Aktif:</span>
                    <img src="${customQrisImg}" alt="QRIS Toko" style="max-width:90px; display:block; border-radius:6px; border:1px solid #ddd; margin-top:3px;">
                </div>
            ` : ''}
        </div>
        <h3 style="font-size:13px; font-weight:700; margin-bottom:8px; color:#1E293B;">Daftar Stok Menu</h3>
    `;

    menuList.forEach((item, index) => {
        const isHabis = item.status === 'habis';
        const imgUrl = item.img || 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80';

        html += `
            <div class="stok-card ${isHabis ? 'habis' : ''}">
                <div class="stok-left">
                    <img src="${imgUrl}" alt="${item.nama}" class="stok-thumb">
                    <div class="stok-name">${item.nama}</div>
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
                    alert("Gambar QRIS berhasil diunggah!");
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

// Helper untuk Ambil Harga Item dengan Aman
function getItemSubtotal(i) {
    if (i.totalHargaItem && !isNaN(i.totalHargaItem)) return i.totalHargaItem;
    if (i.hargaSatuan && !isNaN(i.hargaSatuan)) return i.hargaSatuan * (i.qty || 1);
    if (i.harga && !isNaN(i.harga)) return i.harga * (i.qty || 1);
    return 0;
}

// 2. VERIFIKASI PEMBAYARAN
function renderPembayaran(pesananList) {
    const container = document.getElementById('container-pembayaran');
    if (!container) return;
    let pending = pesananList.filter(p => p.status === 'Menunggu Tunai' || p.status.includes('Lunas QRIS'));

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada pembayaran menunggu verifikasi.</div>`;
        return;
    }

    let html = '';
    pesananList.forEach((order, index) => {
        if (order.status === 'Menunggu Tunai' || order.status.includes('Lunas QRIS')) {
            let itemList = order.items.map(i => {
                const itemHarga = getItemSubtotal(i);
                const varianTxt = i.varian ? ` <small style="color:#64748B;">(${i.varian})</small>` : '';
                const catatanTxt = i.catatan ? `<div style="color:#E11D48; font-size:10.5px; font-weight:600;">Catatan: "${i.catatan}"</div>` : '';

                return `
                    <li style="padding:4px 0; border-bottom:1px dashed #f0f0f0;">
                        <div>
                            <span><b>${i.qty || 1}x</b> ${i.nama}${varianTxt}</span>
                            ${catatanTxt}
                        </div>
                        <b>Rp${itemHarga.toLocaleString('id-ID')}</b>
                    </li>
                `;
            }).join('');

            const isQris = order.metodeBayar === 'QRIS';

            html += `
                <div class="order-card-mobile">
                    <div class="order-card-head">
                        <span class="order-id-txt">#${order.idOrder} (${order.namaPelanggan})</span>
                        <span class="order-pay-tag ${isQris ? 'tag-qris' : 'tag-cash'}">${order.metodeBayar}</span>
                    </div>
                    <p style="font-size:11px; color:var(--text-muted); mb-2">${order.waktu} WIB | Total: <b style="color:var(--primary-red);">${order.totalHargaFormatted}</b></p>
                    <ul class="order-item-ul">${itemList}</ul>
                    
                    ${order.metodeBayar === 'TUNAI' || order.metodeBayar === 'Tunai' ? 
                        `<button class="btn-m-action btn-m-cash" onclick="konfirmasiPembayaran(${index}, 'Proses Masak')">Konfirmasi Terima Tunai & Kirim Dapur</button>` : 
                        `<button class="btn-m-action btn-m-cook" onclick="konfirmasiPembayaran(${index}, 'Proses Masak')">Verifikasi QRIS & Kirim Dapur</button>`
                    }
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

function konfirmasiPembayaran(index, newStatus) {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    semuaPesanan[index].status = newStatus;
    localStorage.setItem('sabangdor_semua_pesanan', JSON.stringify(semuaPesanan));
    renderCurrentSection();
}

// 3. DISPLAY KITCHEN
function switchKitchenTab(type, evt) {
    activeKanbanFilter = type;
    document.querySelectorAll('.k-tab').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
    renderCurrentSection();
}

function renderKitchenDisplay(pesananList, riwayatList) {
    const container = document.getElementById('kanban-content-mobile');
    if (!container) return;

    let listProsesMasak = pesananList.filter(p => p.status === 'Proses Masak');
    let listSelesai = riwayatList;

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
            const catatanTxt = i.catatan ? `<div style="color:#E11D48; font-size:10.5px; font-weight:700;">Catatan: "${i.catatan}"</div>` : '';
            return `<li style="margin-bottom:6px;"><div><b>${i.qty || 1}x ${i.nama}${varianTxt}</b>${catatanTxt}</div></li>`;
        }).join('') : '';

        html += `
            <div class="order-card-mobile">
                <div class="order-card-head">
                    <span class="order-id-txt">#${order.idOrder} - ${order.namaPelanggan}</span>
                    <span style="font-size:11px; font-weight:700; color:var(--text-muted);">${order.waktu} WIB</span>
                </div>
                <ul class="order-item-ul">${itemList}</ul>
        `;

        if (activeKanbanFilter === 'proses-masak') {
            let realIndex = pesananList.findIndex(p => p.idOrder === order.idOrder);
            html += `<button class="btn-m-action btn-m-finish" onclick="tandaiSelesaiDapur(${realIndex})">Konfirmasi Selesai & Sajikan</button></div>`;
        } else {
            html += `<p style="font-size:11px; color:var(--status-green); font-weight:700; margin-top:8px;">Status: Selesai & Disajikan</p></div>`;
        }
    });

    container.innerHTML = html;
}

function tandaiSelesaiDapur(index) {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    let riwayat = JSON.parse(localStorage.getItem('sabangdor_riwayat_transaksi')) || [];

    if (semuaPesanan[index]) {
        let selesai = semuaPesanan.splice(index, 1)[0];
        selesai.status = 'Selesai & Disajikan';
        riwayat.push(selesai);

        localStorage.setItem('sabangdor_semua_pesanan', JSON.stringify(semuaPesanan));
        localStorage.setItem('sabangdor_riwayat_transaksi', JSON.stringify(riwayat));
        renderCurrentSection();
    }
}

// Tambahkan fungsi untuk mereset filter tanggal kembali ke semua riwayat
function resetFilterTanggal() {
    const inputEl = document.getElementById('filterTanggal');
    if (inputEl) inputEl.value = '';
    renderCurrentSection();
}

// 4. RIWAYAT & OMZET (DENGAN FILTER TANGGAL)
function renderRiwayat(riwayatList) {
    const banner = document.getElementById('summary-omzet-card');
    const container = document.getElementById('history-cards-container');
    const filterInput = document.getElementById('filterTanggal');
    if (!container) return;

    let selectedDate = filterInput ? filterInput.value : ''; // Format dari input date: "YYYY-MM-DD"

    // Konversi format tanggal input (YYYY-MM-DD) ke format lokal Indonesia (DD/MM/YYYY) agar cocok dengan data transaksi
    let formattedSelectedDate = '';
    if (selectedDate) {
        const parts = selectedDate.split('-'); // [YYYY, MM, DD]
        if (parts.length === 3) {
            formattedSelectedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    // Filter riwayat berdasarkan tanggal yang dipilih (jika ada)
    let filteredList = riwayatList;
    if (formattedSelectedDate) {
        filteredList = riwayatList.filter(item => item.tanggal === formattedSelectedDate);
    }

    // Hitung total omzet dari data yang sudah difilter
    let totalOmzet = filteredList.reduce((sum, item) => sum + item.totalHarga, 0);

    if (banner) {
        let labelOmzet = formattedSelectedDate ? `Omzet Tanggal ${formattedSelectedDate}` : 'Total Omzet Keseluruhan';
        banner.innerHTML = `
            <p style="font-size:11px; color:#D9C8B8;">${labelOmzet}</p>
            <h2 style="font-size:20px; margin-top:2px;">Rp${totalOmzet.toLocaleString('id-ID')}</h2>
        `;
    }

    if (filteredList.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada riwayat transaksi pada tanggal ini.</div>`;
        return;
    }

    let html = '';
    filteredList.slice().reverse().forEach(item => {
        html += `
            <div class="history-card-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <div>
                    <div style="font-weight:800; font-size:13px;">#${item.idOrder} (${item.namaPelanggan} - ${item.metodeBayar})</div>
                    <div style="font-size:11px; color:var(--text-muted);">${item.tanggal} • ${item.waktu} WIB</div>
                </div>
                <div style="font-size:13px; font-weight:800; color:var(--status-green);">
                    ${item.totalHargaFormatted}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Memeriksa autentikasi session
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '../login-pegawai.html';
    }
}

// Mengakhiri session login
async function handleLogout() {
    try {
        if (typeof supabaseClient !== 'undefined') {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('pegawai_session');
        window.location.href = '../login-pegawai.html';
    } catch (err) {
        console.error('Logout error:', err);
        window.location.href = '../login-pegawai.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
