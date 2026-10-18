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

    // Pertahankan status stok & menu tambahan; hanya tambahkan menu bawaan yang belum ada
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
    else if (currentSec === 'menu') { if (force) renderMenuTambahan(); } // jangan dirender ulang otomatis agar isian form tidak hilang
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
        const imgUrl = item.img || (dataCustom && dataCustom.img) || DEFAULT_MENU_IMG;

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

// ==========================================
// 6. MENU TAMBAHAN (kasir tambah / ubah / hapus menu)
// Membutuhkan menu-custom-store.js (dimuat sebelum file ini)
// ==========================================
let mtEditId = null;   // id menu yang sedang diedit (null = mode tambah)
let mtImg = '';        // foto menu yang sedang diisi di form (data URL)
let mtMsgTimer = null;

// ---------- Utilitas ----------
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

// ---------- Render ----------
function renderMenuTambahan() {
    const container = document.getElementById('container-menu-tambahan');
    if (!container) return;

    // Kerangka dibuat sekali saja supaya isian form tidak hilang saat halaman dirender ulang
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

                <div class="btn-group">
                    <button type="button" class="btn-primary-merchant" id="mt-btn-simpan" onclick="mtSimpan()">Simpan Menu</button>
                    <button type="button" class="btn-outline-merchant" id="mt-btn-batal" onclick="mtResetForm()" style="display:none;">Batal</button>
                </div>
            </div>

            <div class="card-title" id="mt-list-title" style="margin-top:10px;"></div>
            <div id="mt-list"></div>
        `;

        document.getElementById('mt-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                mtImg = await mtKompresGambar(file);
                document.getElementById('mt-photo-preview').src = mtImg;
            } catch (err) {
                mtPesan('Foto tidak bisa dibaca, coba foto lain.', true);
            }
            e.target.value = '';
        });

        mtResetForm();
    }

    mtIsiOpsiKategori();
    mtRenderDaftar();
}

function mtIsiOpsiKategori(pilih) {
    const sel = document.getElementById('mt-kategori');
    if (!sel) return;
    const nilaiSekarang = pilih || sel.value;
    let html = mtKategoriTersedia().map(k => `<option value="${escHtml(k)}">${escHtml(k)}</option>`).join('');
    html += '<option value="__baru__">➕ Kategori baru...</option>';
    sel.innerHTML = html;
    if (nilaiSekarang && [...sel.options].some(o => o.value === nilaiSekarang)) sel.value = nilaiSekarang;
    mtToggleKategoriBaru();
}

function mtToggleKategoriBaru() {
    const sel = document.getElementById('mt-kategori');
    const inp = document.getElementById('mt-kategori-baru');
    if (sel && inp) inp.style.display = sel.value === '__baru__' ? 'block' : 'none';
}

// ---------- Baris ukuran & tambahan ----------
function mtTambahUkuran(data) {
    const wrap = document.getElementById('mt-ukuran-rows');
    const row = document.createElement('div');
    row.className = 'mt-row mt-ukuran-row';
    row.innerHTML = `
        <input type="text" class="mt-input mt-in-nama" maxlength="12" placeholder="Ukuran (S)">
        <input type="text" class="mt-input mt-in-ket" maxlength="20" placeholder="Isi (3 pcs)">
        <input type="number" class="mt-input mt-in-harga" inputmode="numeric" min="0" placeholder="Harga">
        <button type="button" class="mt-btn-x" aria-label="Hapus baris">✕</button>
    `;
    if (data) {
        row.querySelector('.mt-in-nama').value = data.nama || '';
        row.querySelector('.mt-in-ket').value = data.ket || '';
        row.querySelector('.mt-in-harga').value = data.harga || '';
    }
    row.querySelector('.mt-btn-x').addEventListener('click', () => {
        if (wrap.children.length > 1) row.remove();
        else mtPesan('Minimal harus ada satu ukuran.', true);
    });
    wrap.appendChild(row);
}

function mtTambahAddon(data) {
    const wrap = document.getElementById('mt-addon-rows');
    const row = document.createElement('div');
    row.className = 'mt-row mt-addon-row';
    row.innerHTML = `
        <input type="text" class="mt-input mt-in-nama" maxlength="30" placeholder="Nama tambahan (Extra Keju)">
        <input type="number" class="mt-input mt-in-harga" inputmode="numeric" min="0" placeholder="Harga">
        <button type="button" class="mt-btn-x" aria-label="Hapus baris">✕</button>
    `;
    if (data) {
        row.querySelector('.mt-in-nama').value = data.nama || '';
        row.querySelector('.mt-in-harga').value = data.harga || '';
    }
    row.querySelector('.mt-btn-x').addEventListener('click', () => row.remove());
    wrap.appendChild(row);
}

// ---------- Form ----------
function mtResetForm() {
    mtEditId = null;
    mtImg = '';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('mt-nama', '');
    set('mt-deskripsi', '');
    set('mt-gratis', '');
    set('mt-kategori-baru', '');
    document.getElementById('mt-photo-preview').src = DEFAULT_MENU_IMG;
    document.getElementById('mt-ukuran-rows').innerHTML = '';
    document.getElementById('mt-addon-rows').innerHTML = '';
    mtTambahUkuran();
    document.getElementById('mt-form-title').textContent = '➕ Tambah Menu Baru';
    document.getElementById('mt-btn-simpan').textContent = 'Simpan Menu';
    document.getElementById('mt-btn-batal').style.display = 'none';
    mtIsiOpsiKategori();
}

function mtEdit(id) {
    const menu = getCustomMenus().find(m => m.id === id);
    if (!menu) return;

    mtEditId = id;
    mtImg = menu.img || '';
    document.getElementById('mt-nama').value = menu.nama;
    document.getElementById('mt-deskripsi').value = menu.deskripsi || '';
    document.getElementById('mt-gratis').value = menu.gratis || '';
    document.getElementById('mt-photo-preview').src = menu.img || DEFAULT_MENU_IMG;
    mtIsiOpsiKategori(menu.kategori);
    document.getElementById('mt-kategori').value = menu.kategori;
    mtToggleKategoriBaru();

    document.getElementById('mt-ukuran-rows').innerHTML = '';
    (menu.ukuran || []).forEach(u => mtTambahUkuran(u));
    if (!menu.ukuran || !menu.ukuran.length) mtTambahUkuran();

    document.getElementById('mt-addon-rows').innerHTML = '';
    (menu.addon || []).forEach(a => mtTambahAddon(a));

    document.getElementById('mt-form-title').textContent = '✏️ Ubah Menu';
    document.getElementById('mt-btn-simpan').textContent = 'Simpan Perubahan';
    document.getElementById('mt-btn-batal').style.display = 'block';
    document.getElementById('mt-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mtSimpan() {
    const nama = document.getElementById('mt-nama').value.trim();
    if (!nama) return mtPesan('Nama menu wajib diisi.', true);

    let kategori = document.getElementById('mt-kategori').value;
    if (kategori === '__baru__') kategori = document.getElementById('mt-kategori-baru').value.trim();
    if (!kategori) return mtPesan('Nama kategori baru wajib diisi.', true);

    // Nama harus unik karena status stok pembeli dicocokkan lewat nama menu
    const namaLower = nama.toLowerCase();
    const bentrokBawaan = typeof masterMenuSabangdor !== 'undefined' &&
        masterMenuSabangdor.some(m => m.nama.toLowerCase() === namaLower);
    const bentrokCustom = getCustomMenus().some(m => m.id !== mtEditId && m.nama.toLowerCase() === namaLower);
    if (bentrokBawaan || bentrokCustom) return mtPesan('Nama menu sudah dipakai menu lain.', true);

    const ukuran = [];
    for (const row of document.querySelectorAll('#mt-ukuran-rows .mt-ukuran-row')) {
        const n = row.querySelector('.mt-in-nama').value.trim();
        const ket = row.querySelector('.mt-in-ket').value.trim();
        const harga = parseInt(row.querySelector('.mt-in-harga').value, 10) || 0;
        if (!n && !ket && !harga) continue;
        if (!n || harga <= 0) return mtPesan('Setiap ukuran perlu nama dan harga lebih dari 0.', true);
        ukuran.push({ nama: n, ket, harga });
    }
    if (ukuran.length === 0) return mtPesan('Isi minimal satu ukuran dan harga.', true);

    const addon = [];
    for (const row of document.querySelectorAll('#mt-addon-rows .mt-addon-row')) {
        const n = row.querySelector('.mt-in-nama').value.trim();
        const harga = parseInt(row.querySelector('.mt-in-harga').value, 10) || 0;
        if (!n && !harga) continue;
        if (!n || harga <= 0) return mtPesan('Setiap tambahan perlu nama dan harga lebih dari 0.', true);
        addon.push({ nama: n, harga });
    }

    const menu = {
        id: mtEditId || ('custom-' + Date.now().toString(36)),
        nama,
        kategori,
        deskripsi: document.getElementById('mt-deskripsi').value.trim(),
        img: mtImg,
        gratis: document.getElementById('mt-gratis').value.trim(),
        ukuran,
        addon
    };

    const daftar = getCustomMenus();
    const idx = daftar.findIndex(m => m.id === menu.id);
    if (idx >= 0) daftar[idx] = menu; else daftar.push(menu);
    if (!saveCustomMenus(daftar)) return;

    mtSinkronStatus(menu);

    const sedangEdit = idx >= 0;
    mtResetForm();
    mtRenderDaftar();
    mtPesan(sedangEdit ? 'Perubahan tersimpan.' : 'Menu berhasil ditambahkan dan sudah tampil di halaman pembeli.', false);
}

function mtHapus(id) {
    const menu = getCustomMenus().find(m => m.id === id);
    if (!menu) return;
    if (!confirm(`Hapus menu "${menu.nama}"? Menu akan hilang dari halaman pembeli.`)) return;

    saveCustomMenus(getCustomMenus().filter(m => m.id !== id));

    let status = JSON.parse(localStorage.getItem(MENU_STATUS_KEY)) || [];
    localStorage.setItem(MENU_STATUS_KEY, JSON.stringify(status.filter(s => s.id !== id)));

    if (mtEditId === id) mtResetForm();
    mtIsiOpsiKategori();
    mtRenderDaftar();
}

// Samakan dengan daftar stok (sabangdor_menu_status) supaya bisa di-toggle "Habis" di tab Stok
function mtSinkronStatus(menu) {
    let status = JSON.parse(localStorage.getItem(MENU_STATUS_KEY)) || [];
    const idx = status.findIndex(s => s.id === menu.id);
    const entri = {
        id: menu.id,
        nama: menu.nama,
        harga: hargaMulai(menu),
        status: idx >= 0 ? status[idx].status : 'tersedia',
        img: '',          // foto diambil dari sabangdor_custom_menus agar penyimpanan tidak dobel
        custom: true
    };
    if (idx >= 0) status[idx] = entri; else status.push(entri);
    localStorage.setItem(MENU_STATUS_KEY, JSON.stringify(status));
}

// ---------- Daftar menu tambahan ----------
function mtRenderDaftar() {
    const list = document.getElementById('mt-list');
    const title = document.getElementById('mt-list-title');
    if (!list) return;

    const daftar = getCustomMenus();
    title.textContent = `Menu Tambahan Saya (${daftar.length})`;

    if (daftar.length === 0) {
        list.innerHTML = '<div class="empty-info">Belum ada menu tambahan. Isi form di atas untuk menambahkan.</div>';
        return;
    }

    list.innerHTML = daftar.map(m => `
        <div class="stok-card">
            <div class="stok-left">
                <img src="${m.img || DEFAULT_MENU_IMG}" class="stok-thumb" alt="${escHtml(m.nama)}">
                <div class="mt-info">
                    <span class="stok-name">${escHtml(m.nama)}</span>
                    <span class="mt-meta">${escHtml(m.kategori)} • Mulai ${rupiah(hargaMulai(m))}</span>
                </div>
            </div>
            <div class="mt-actions">
                <button type="button" class="mt-btn-small" onclick="mtEdit('${m.id}')">Ubah</button>
                <button type="button" class="mt-btn-small danger" onclick="mtHapus('${m.id}')">Hapus</button>
            </div>
        </div>
    `).join('');
}