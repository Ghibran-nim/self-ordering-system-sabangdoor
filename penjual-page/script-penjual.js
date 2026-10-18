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

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabaseClient !== 'undefined') {
        console.log("Supabase URL yang dipakai dashboard:", supabaseClient.supabaseUrl);
    } else {
        console.error("supabaseClient tidak ditemukan! Cek file config Supabase.");
    }

    checkAuth();

    // Sinkronkan data menu custom dari Supabase
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
    else if (currentSec === 'menu') { if (force) renderMenuTambahan(); }
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
        const dataCustom = item.custom ? getCustomMenus().find(m => m.id === item.id) : null;
        const imgUrl = item.img || (dataCustom && (dataCustom.img || dataCustom.img_url)) || DEFAULT_MENU_IMG;

        html += `
            <div class="stok-card">
                <div class="stok-left">
                    <img src="${imgUrl}" class="stok-thumb" alt="${escHtml(item.nama)}">
                    <span class="stok-name">${escHtml(item.nama)}</span>
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
            alert("Update tidak mengubah data apa pun.");
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

// ==========================================
// 6. MENU TAMBAHAN (kasir tambah / ubah / hapus menu)
// ==========================================
let mtEditId = null;
let mtImg = '';
let mtMsgTimer = null;

function mtKompresGambar(file, maxSize = 500, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const skala = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * skala);
                canvas.height = Math.round(img.height * skala);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function mtPesan(teks, isError) {
    const el = document.getElementById('mt-msg');
    if (!el) return;
    el.textContent = teks;
    el.className = 'mt-msg show ' + (isError ? 'error' : 'ok');
    clearTimeout(mtMsgTimer);
    mtMsgTimer = setTimeout(() => { el.className = 'mt-msg'; }, 3500);
}

function mtKategoriTersedia() {
    const bawaan = Object.keys(KATEGORI_BAWAAN);
    const custom = [];
    getCustomMenus().forEach(m => {
        if (!bawaan.includes(m.kategori) && !custom.includes(m.kategori)) custom.push(m.kategori);
    });
    return bawaan.concat(custom);
}

function renderMenuTambahan() {
    const container = document.getElementById('container-menu-tambahan');
    if (!container) return;

    if (!document.getElementById('mt-form-card')) {
        container.innerHTML = `
            <div class="card" id="mt-form-card">
                <div class="card-title" id="mt-form-title">➕ Tambah Menu Baru</div>
                <div class="card-sub">Menu langsung tampil di halaman pembeli lengkap dengan detail menunya</div>

                <div class="mt-field">
                    <label>Foto menu</label>
                    <div class="mt-photo">
                        <img id="mt-photo-preview" src="${DEFAULT_MENU_IMG}" alt="Foto menu">
                        <div>
                            <button type="button" class="btn-upload-custom" onclick="document.getElementById('mt-file').click()">📷 Pilih Foto</button>
                            <input type="file" id="mt-file" accept="image/*" style="display:none;">
                            <div class="mt-hint">Kosongkan jika belum ada foto</div>
                        </div>
                    </div>
                </div>

                <div class="mt-field">
                    <label for="mt-nama">Nama menu</label>
                    <input type="text" id="mt-nama" class="mt-input" maxlength="40" placeholder="Contoh: Siomay Ayam">
                </div>

                <div class="mt-field">
                    <label for="mt-kategori">Kategori</label>
                    <select id="mt-kategori" class="mt-input" onchange="mtToggleKategoriBaru()"></select>
                    <input type="text" id="mt-kategori-baru" class="mt-input" maxlength="24" placeholder="Nama kategori baru, contoh: Minuman" style="display:none; margin-top:8px;">
                </div>

                <div class="mt-field">
                    <label for="mt-deskripsi">Deskripsi singkat</label>
                    <textarea id="mt-deskripsi" class="mt-input" rows="2" maxlength="140" placeholder="Contoh: Dimsum ayam lembut dengan saus spesial."></textarea>
                </div>

                <div class="mt-field">
                    <label>Ukuran / porsi & harga</label>
                    <div class="mt-hint" style="margin-bottom:8px;">Menu satu harga? Isi satu baris saja, misalnya Reguler • 1 porsi • 10000.</div>
                    <div id="mt-ukuran-rows"></div>
                    <button type="button" class="mt-btn-add" onclick="mtTambahUkuran()">+ Tambah ukuran</button>
                </div>

                <div class="mt-field">
                    <label for="mt-gratis">Bonus gratis (opsional)</label>
                    <input type="text" id="mt-gratis" class="mt-input" maxlength="24" placeholder="Contoh: Free Chilli Oil">
                </div>

                <div class="mt-field">
                    <label>Tambahan opsional (opsional)</label>
                    <div id="mt-addon-rows"></div>
                    <button type="button" class="mt-btn-add" onclick="mtTambahAddon()">+ Tambah pilihan tambahan</button>
                </div>

                <div id="mt-msg" class="mt-msg"></div>

                <div class="mt-actions">
                    <button type="button" class="btn-primary-merchant" style="flex:2;" onclick="mtSimpan()">Simpan Menu</button>
                    <button type="button" id="mt-btn-batal" class="btn-outline-merchant" style="flex:1; display:none;" onclick="mtResetForm()">Batal</button>
                </div>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-title">Menu Tambahan Saya (<span id="mt-count">0</span>)</div>
                <div id="mt-list" class="mt-list"></div>
            </div>
        `;

        const fileInput = document.getElementById('mt-file');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    mtImg = await mtKompresGambar(file);
                    document.getElementById('mt-photo-preview').src = mtImg;
                } catch (err) {
                    mtPesan('Gagal membaca gambar', true);
                }
            });
        }
    }

    mtRenderKategoriOptions();
    mtRenderListCustom();
}

function mtRenderKategoriOptions(selected) {
    const sel = document.getElementById('mt-kategori');
    if (!sel) return;
    const katList = mtKategoriTersedia();
    let html = katList.map(k => `<option value="${escHtml(k)}">${escHtml(k)}</option>`).join('');
    html += `<option value="__baru__">+ Buat kategori baru...</option>`;
    sel.innerHTML = html;
    if (selected) sel.value = selected;
    mtToggleKategoriBaru();
}

function mtToggleKategoriBaru() {
    const sel = document.getElementById('mt-kategori');
    const inputBaru = document.getElementById('mt-kategori-baru');
    if (!sel || !inputBaru) return;
    inputBaru.style.display = sel.value === '__baru__' ? 'block' : 'none';
}

function mtTambahUkuran(nama = '', ket = '', harga = '') {
    const container = document.getElementById('mt-ukuran-rows');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'mt-row';
    row.innerHTML = `
        <input type="text" class="mt-input mt-u-nama" placeholder="Ukuran (S)" value="${escHtml(nama)}">
        <input type="text" class="mt-input mt-u-ket" placeholder="Isi (3 pcs)" value="${escHtml(ket)}">
        <input type="number" class="mt-input mt-u-harga" placeholder="Harga" value="${harga}">
        <button type="button" class="mt-row-del" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

function mtTambahAddon(nama = '', harga = '') {
    const container = document.getElementById('mt-addon-rows');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'mt-row';
    row.innerHTML = `
        <input type="text" class="mt-input mt-a-nama" placeholder="Nama addon" value="${escHtml(nama)}">
        <input type="number" class="mt-input mt-a-harga" placeholder="Harga" value="${harga}">
        <button type="button" class="mt-row-del" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

function mtAmbilDataForm() {
    const nama = (document.getElementById('mt-nama').value || '').trim();

    let kategori = document.getElementById('mt-kategori').value;
    if (kategori === '__baru__') {
        kategori = (document.getElementById('mt-kategori-baru').value || '').trim();
    }

    const deskripsi = (document.getElementById('mt-deskripsi').value || '').trim();
    const gratis = (document.getElementById('mt-gratis').value || '').trim();

    const ukuran = [];
    document.querySelectorAll('#mt-ukuran-rows .mt-row').forEach(r => {
        const uNama = (r.querySelector('.mt-u-nama').value || '').trim();
        const uKet = (r.querySelector('.mt-u-ket').value || '').trim();
        const uHarga = Number(r.querySelector('.mt-u-harga').value) || 0;
        if (uNama || uHarga > 0) {
            ukuran.push({ nama: uNama || 'Reguler', ket: uKet, harga: uHarga });
        }
    });

    const addon = [];
    document.querySelectorAll('#mt-addon-rows .mt-row').forEach(r => {
        const aNama = (r.querySelector('.mt-a-nama').value || '').trim();
        const aHarga = Number(r.querySelector('.mt-a-harga').value) || 0;
        if (aNama) {
            addon.push({ nama: aNama, harga: aHarga });
        }
    });

    return { nama, kategori, deskripsi, gratis, ukuran, addon };
}

// INTEGRASI SUPABASE PADA FUNGSI SIMPAN & HAPUS
async function mtSimpan() {
    const data = mtAmbilDataForm();

    if (!data.nama) { mtPesan('Nama menu wajib diisi.', true); return; }
    if (!data.kategori) { mtPesan('Pilih atau ketik kategori baru.', true); return; }
    if (data.ukuran.length === 0) { mtPesan('Isi minimal satu ukuran/porsi & harga.', true); return; }

    const itemObj = {
        id: mtEditId || ('custom-' + Math.random().toString(36).substring(2, 9)),
        nama: data.nama,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        img: mtImg || DEFAULT_MENU_IMG,
        gratis: data.gratis,
        ukuran: data.ukuran,
        addon: data.addon
    };

    // Panggil helper simpan ke Supabase & LocalStorage
    let ok = false;
    if (typeof saveCustomMenuToSupabase === 'function') {
        ok = await saveCustomMenuToSupabase(itemObj);
    } else {
        let list = getCustomMenus();
        if (mtEditId) {
            const idx = list.findIndex(m => m.id === mtEditId);
            if (idx >= 0) list[idx] = itemObj;
            else list.push(itemObj);
        } else {
            list.push(itemObj);
        }
        ok = saveCustomMenus(list);
    }

    if (!ok) return;

    // Tambahkan status ketersediaan ke stok menu lokal
    let menuStatus = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || masterMenuSabangdor;
    const idxStok = menuStatus.findIndex(m => m.id === itemObj.id);
    if (idxStok >= 0) {
        menuStatus[idxStok].nama = itemObj.nama;
        menuStatus[idxStok].custom = true;
        menuStatus[idxStok].img = itemObj.img;
    } else {
        menuStatus.push({
            id: itemObj.id,
            nama: itemObj.nama,
            harga: hargaMulai(itemObj),
            status: 'tersedia',
            custom: true,
            img: itemObj.img
        });
    }
    localStorage.setItem('sabangdor_menu_status', JSON.stringify(menuStatus));

    mtPesan(mtEditId ? 'Menu berhasil diperbarui!' : 'Menu berhasil ditambahkan dan tersimpan ke Supabase!');
    mtResetForm();
    mtRenderKategoriOptions();
    mtRenderListCustom();
}

function mtEdit(id) {
    const menu = getCustomMenus().find(m => m.id === id);
    if (!menu) return;

    mtEditId = menu.id;
    mtImg = menu.img || menu.img_url || '';

    document.getElementById('mt-form-title').textContent = '✏️ Ubah Menu Tambahan';
    document.getElementById('mt-nama').value = menu.nama || '';
    document.getElementById('mt-deskripsi').value = menu.deskripsi || '';
    document.getElementById('mt-gratis').value = menu.gratis || '';
    document.getElementById('mt-photo-preview').src = mtImg || DEFAULT_MENU_IMG;
    document.getElementById('mt-btn-batal').style.display = 'block';

    mtRenderKategoriOptions(menu.kategori);

    const uBox = document.getElementById('mt-ukuran-rows');
    uBox.innerHTML = '';
    (menu.ukuran || []).forEach(u => mtTambahUkuran(u.nama, u.ket, u.harga));

    const aBox = document.getElementById('mt-addon-rows');
    aBox.innerHTML = '';
    (menu.addon || []).forEach(a => mtTambahAddon(a.nama, a.harga));

    document.getElementById('mt-form-card').scrollIntoView({ behavior: 'smooth' });
}

async function mtHapus(id) {
    if (!confirm('Hapus menu ini dari daftar?')) return;

    if (typeof deleteCustomMenuFromSupabase === 'function') {
        await deleteCustomMenuFromSupabase(id);
    } else {
        let list = getCustomMenus().filter(m => m.id !== id);
        saveCustomMenus(list);
    }

    let menuStatus = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || [];
    menuStatus = menuStatus.filter(m => m.id !== id);
    localStorage.setItem('sabangdor_menu_status', JSON.stringify(menuStatus));

    if (mtEditId === id) mtResetForm();
    mtRenderKategoriOptions();
    mtRenderListCustom();
    mtPesan('Menu berhasil dihapus!');
}

function mtResetForm() {
    mtEditId = null;
    mtImg = '';
    document.getElementById('mt-form-title').textContent = '➕ Tambah Menu Baru';
    document.getElementById('mt-nama').value = '';
    document.getElementById('mt-deskripsi').value = '';
    document.getElementById('mt-gratis').value = '';
    document.getElementById('mt-kategori-baru').value = '';
    document.getElementById('mt-photo-preview').src = DEFAULT_MENU_IMG;
    document.getElementById('mt-file').value = '';
    document.getElementById('mt-btn-batal').style.display = 'none';

    const uBox = document.getElementById('mt-ukuran-rows');
    uBox.innerHTML = '';
    mtTambahUkuran('Reguler', '1 porsi', '');

    const aBox = document.getElementById('mt-addon-rows');
    aBox.innerHTML = '';

    mtRenderKategoriOptions();
}

function mtRenderListCustom() {
    const list = getCustomMenus();
    const countEl = document.getElementById('mt-count');
    const container = document.getElementById('mt-list');

    if (countEl) countEl.textContent = list.length;
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-info">Belum ada menu tambahan yang dibuat.</div>`;
        return;
    }

    let html = '';
    list.forEach(m => {
        const minHarga = hargaMulai(m);
        const imgUrl = m.img || m.img_url || DEFAULT_MENU_IMG;
        html += `
            <div class="mt-card-item">
                <img src="${imgUrl}" alt="${escHtml(m.nama)}" class="mt-item-thumb">
                <div class="mt-item-info">
                    <div class="mt-item-title">${escHtml(m.nama)}</div>
                    <div class="mt-item-sub">${escHtml(m.kategori)} • Mulai ${rupiah(minHarga)}</div>
                </div>
                <div class="mt-item-actions">
                    <button type="button" class="mt-btn-edit" onclick="mtEdit('${m.id}')">Ubah</button>
                    <button type="button" class="mt-btn-del" onclick="mtHapus('${m.id}')">Hapus</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}