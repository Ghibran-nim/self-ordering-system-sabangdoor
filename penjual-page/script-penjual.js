// Master List Menu Sabangdor
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
    
    // Refresh otomatis real-time setiap 2 detik
    setInterval(renderCurrentSection, 2000);
});

let currentSec = 'dashboard';
let activeKanbanFilter = 'terkirim';

function navigate(secKey, el) {
    currentSec = secKey;

    document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${secKey}`).classList.add('active');

    const titleMap = {
        'dashboard': { t: 'Manajemen Stok Menu', s: 'Atur Ketersediaaan Menu' },
        'pembayaran': { t: 'Verifikasi Pembayaran', s: 'Konfirmasi masuknya bayar QRIS & Tunai dari pembeli' },
        'pantau': { t: 'Pantau Dapur (Antrian)', s: 'Kelola status masakan hingga siap disajikan ke pembeli' },
        'riwayat': { t: 'Riwayat Transaksi', s: 'Arsip transaksi selesai & total omzet harian' }
    };

    document.getElementById('page-title').innerText = titleMap[secKey].t;
    document.getElementById('page-subtitle').innerText = titleMap[secKey].s;

    renderCurrentSection();
}

function renderCurrentSection() {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    let riwayat = JSON.parse(localStorage.getItem('sabangdor_riwayat_transaksi')) || [];

    // Update Badge Notifikasi Pembayaran
    let pendingPay = semuaPesanan.filter(p => p.status === 'Menunggu Tunai' || p.status.includes('Lunas QRIS')).length;
    const badgeEl = document.getElementById('badge-notif-bayar');
    if (pendingPay > 0) {
        badgeEl.style.display = 'inline-block';
        badgeEl.innerText = pendingPay;
    } else {
        badgeEl.style.display = 'none';
    }

    if (currentSec === 'dashboard') renderStokMenu();
    else if (currentSec === 'pembayaran') renderPembayaran(semuaPesanan);
    else if (currentSec === 'pantau') renderKanbanMobile(semuaPesanan);
    else if (currentSec === 'riwayat') renderRiwayat(riwayat);
}

// 1. STOK MENU (Gambar + Tanpa Harga)
function renderStokMenu() {
    const grid = document.getElementById('grid-stok-menu');
    let menuList = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;

    grid.innerHTML = '';
    menuList.forEach((item, index) => {
        const isHabis = item.status === 'habis';
        const imgUrl = item.img || 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80';

        grid.innerHTML += `
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
}

function toggleStok(index) {
    let menuList = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;
    menuList[index].status = menuList[index].status === 'tersedia' ? 'habis' : 'tersedia';
    localStorage.setItem('sabangdor_menu_status', JSON.stringify(menuList));
    renderStokMenu();
}

// 2. VERIFIKASI PEMBAYARAN
function renderPembayaran(pesananList) {
    const container = document.getElementById('container-pembayaran');
    let pending = pesananList.filter(p => p.status === 'Menunggu Tunai' || p.status.includes('Lunas QRIS'));

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada pembayaran menunggu verifikasi.</div>`;
        return;
    }

    let html = '';
    pesananList.forEach((order, index) => {
        if (order.status === 'Menunggu Tunai' || order.status.includes('Lunas QRIS')) {
            let itemList = order.items.map(i => `<li><span>${i.qty || 1}x ${i.nama}</span><span>Rp${(i.harga * (i.qty || 1)).toLocaleString('id-ID')}</span></li>`).join('');
            const isQris = order.metodeBayar === 'QRIS';

            html += `
                <div class="order-card-mobile">
                    <div class="order-card-head">
                        <span class="order-id-txt">#${order.idOrder}</span>
                        <span class="order-pay-tag ${isQris ? 'tag-qris' : 'tag-cash'}">${order.metodeBayar}</span>
                    </div>
                    <p style="font-size:11px; color:var(--text-muted);">${order.waktu} WIB | Total: <b style="color:var(--primary-red);">${order.totalHargaFormatted}</b></p>
                    <ul class="order-item-ul">${itemList}</ul>
                    
                    ${order.metodeBayar === 'Tunai' ? 
                        `<button class="btn-m-action btn-m-cash" onclick="updateOrderStatus(${index}, 'Diproses (Lunas Cash)')">Konfirmasi Terima Tunai</button>` : 
                        `<button class="btn-m-action btn-m-cook" onclick="updateOrderStatus(${index}, 'Diproses (Lunas QRIS)')">Kirim Ke Dapur</button>`
                    }
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

function updateOrderStatus(index, newStatus) {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    semuaPesanan[index].status = newStatus;
    localStorage.setItem('sabangdor_semua_pesanan', JSON.stringify(semuaPesanan));
    renderCurrentSection();
}

// 3. PANTAU KANBAN (MOBILE TABS)
function switchKanbanTab(type, evt) {
    activeKanbanFilter = type;
    document.querySelectorAll('.k-tab').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
    renderCurrentSection();
}

function renderKanbanMobile(pesananList) {
    const container = document.getElementById('kanban-content-mobile');
    
    let cTerkirim = pesananList.filter(p => p.status.includes('Lunas')).length;
    let cDiproses = pesananList.filter(p => p.status === 'Sedang Dimasak').length;
    let cSelesai = JSON.parse(localStorage.getItem('sabangdor_riwayat_transaksi')) || [];

    document.getElementById('count-terkirim').innerText = cTerkirim;
    document.getElementById('count-diproses').innerText = cDiproses;
    document.getElementById('count-selesai').innerText = cSelesai.length;

    let filtered = [];
    if (activeKanbanFilter === 'terkirim') filtered = pesananList.filter(p => p.status.includes('Lunas'));
    else if (activeKanbanFilter === 'diproses') filtered = pesananList.filter(p => p.status === 'Sedang Dimasak');
    else if (activeKanbanFilter === 'selesai') filtered = cSelesai;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-info">Tidak ada pesanan di kategori ini.</div>`;
        return;
    }

    let html = '';
    filtered.forEach((order, index) => {
        let itemList = order.items ? order.items.map(i => `<li><span>${i.qty || 1}x ${i.nama}</span></li>`).join('') : '';
        
        html += `
            <div class="order-card-mobile">
                <div class="order-card-head">
                    <span class="order-id-txt">#${order.idOrder}</span>
                    <span style="font-size:11px; font-weight:700; color:var(--text-muted);">${order.waktu} WIB</span>
                </div>
                <ul class="order-item-ul">${itemList}</ul>
        `;

        if (activeKanbanFilter === 'terkirim') {
            html += `<button class="btn-m-action btn-m-cook" onclick="updateOrderStatus(${index}, 'Sedang Dimasak')">Mulai Dimasak</button></div>`;
        } else if (activeKanbanFilter === 'diproses') {
            html += `<button class="btn-m-action btn-m-finish" onclick="selesaikanOrder(${index})">Klik Selesai & Sajikan</button></div>`;
        } else {
            html += `<p style="font-size:11px; color:var(--status-green); font-weight:700;">Status: Selesai & Disajikan</p></div>`;
        }
    });

    container.innerHTML = html;
}

function selesaikanOrder(index) {
    let semuaPesanan = JSON.parse(localStorage.getItem('sabangdor_semua_pesanan')) || [];
    let riwayat = JSON.parse(localStorage.getItem('sabangdor_riwayat_transaksi')) || [];

    let selesai = semuaPesanan.splice(index, 1)[0];
    selesai.status = 'Selesai & Disajikan';
    riwayat.push(selesai);

    localStorage.setItem('sabangdor_semua_pesanan', JSON.stringify(semuaPesanan));
    localStorage.setItem('sabangdor_riwayat_transaksi', JSON.stringify(riwayat));
    renderCurrentSection();
}

// 4. RIWAYAT & OMZET
function renderRiwayat(riwayatList) {
    const banner = document.getElementById('summary-omzet-card');
    const container = document.getElementById('history-cards-container');

    let totalOmzet = riwayatList.reduce((sum, item) => sum + item.totalHarga, 0);

    banner.innerHTML = `
        <p style="font-size:11px; color:#D9C8B8;">Total Omzet Penjualan Selesai Hari Ini</p>
        <h2 style="font-size:22px; margin-top:2px;">Rp${totalOmzet.toLocaleString('id-ID')}</h2>
    `;

    if (riwayatList.length === 0) {
        container.innerHTML = `<div class="empty-info">Belum ada riwayat transaksi selesai.</div>`;
        return;
    }

    let html = '';
    riwayatList.forEach(item => {
        html += `
            <div class="history-card-item">
                <div>
                    <div style="font-weight:800; font-size:13px;">#${item.idOrder} (${item.metodeBayar})</div>
                    <div style="font-size:11px; color:var(--text-muted);">${item.tanggal} • ${item.waktu}</div>
                </div>
                <div style="font-size:13px; font-weight:800; color:var(--status-green);">
                    ${item.totalHargaFormatted}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
