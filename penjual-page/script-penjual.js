
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
            window.location.href = '../login-pegawai.html';
        }
    } catch (err) {
        console.error("Gagal memeriksa autentikasi:", err);
        window.location.href = '../login-pegawai.html';
    }
}

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
    // Debug: pastikan dashboard terhubung ke project Supabase yang benar
    if (typeof supabaseClient !== 'undefined') {
        console.log("Supabase URL yang dipakai dashboard:", supabaseClient.supabaseUrl);
    } else {
        console.error("supabaseClient tidak ditemukan! Cek file config Supabase.");
    }

    checkAuth();

    let savedMenu = JSON.parse(localStorage.getItem('sabangdor_menu_status'));
    if (!savedMenu || savedMenu.length !== masterMenuSabangdor.length) {
        localStorage.setItem('sabangdor_menu_status', JSON.stringify(masterMenuSabangdor));
    }

    navigate('dashboard', document.querySelectorAll('.tab-item')[0]);

    // Interval rutin 3 detik untuk fetch data pesanan dari Supabase
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
                    jumlah,
                    subtotal,
                    menus ( nama_dimsum )
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
                    nama: item.menus ? item.menus.nama_dimsum : 'Menu Dimsum',
                    qty: item.jumlah,
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
    // Riwayat = hanya pesanan yang benar-benar selesai
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
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert("Session pegawai berakhir. Silakan login kembali.");
            window.location.href = '../login-pegawai.html';
            return;
        }

        // UPDATE KE TABEL ORDERS + .select() untuk memverifikasi baris yang berubah
        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status_pembayaran: 'lunas',
                status_pesanan: 'disiapkan'
            })
            .eq('id_order', dbIdOrder)
            .select();

        if (error) {
            console.error("Gagal update status pembayaran:", error);
            alert("Gagal memperbarui status: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.warn("Update 0 baris. id_order:", dbIdOrder);
            alert("Update tidak mengubah data apa pun. Cek RLS atau pastikan project Supabase sudah benar.");
            return;
        }

        console.log(`Transaksi ID #${dbIdOrder} berhasil menjadi LUNAS:`, data[0]);
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
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = '../login-pegawai.html';
            return;
        }

        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status_pembayaran: 'lunas',
                status_pesanan: 'selesai'
            })
            .eq('id_order', dbIdOrder)
            .select();

        if (error) {
            console.error("Gagal update status selesai:", error);
            alert("Gagal: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.warn("Update 0 baris. id_order:", dbIdOrder);
            alert("Update tidak mengubah data apa pun. Cek RLS atau project Supabase.");
            return;
        }

        console.log(`Pesanan ID #${dbIdOrder} berhasil menjadi SELESAI:`, data[0]);
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
                @page { size: 58mm auto; margin: 0; }
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