/**
 - File: js/script-menu-utama.js
 */

let menuRekomendasiAI = [];

// 1. Fungsi Switch Kategori Tab
function pilihKategori(event, targetId) {
    if (event) event.preventDefault();

    const clickedButton = event ? event.currentTarget : null;

    if (clickedButton) {
        document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
    }

    // Sembunyikan seluruh section menu, lalu tampilkan HANYA section yang dipilih
    document.querySelectorAll('.menu-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// 2. Load saat halaman siap
window.addEventListener('DOMContentLoaded', () => {
    renderMenuCustom();
    updateTampilanStokPembeli();
    renderPopupKeranjang();
    initStaffTrigger();
});

// 3. FUNGSI RENDER REKOMENDASI (Dibiarkan kosong/aman jika section-nya masih ada di HTML)
function renderRekomendasiAI() {
    const container = document.getElementById('rekomendasi-container');
    if (!container) return;

    if (menuRekomendasiAI.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 24px 12px; background: #fff; border-radius: 12px; border: 1px solid var(--border-line);">
                <p style="font-size: 13px; font-weight: 700; color: var(--text-muted); margin: 0;">Belum ada rekomendasi menu saat ini.</p>
            </div>
        `;
        return;
    }

    let html = '';
    menuRekomendasiAI.forEach(item => {
        html += `
            <div class="card-menu">
                <img src="${escHtml(item.imgSrc || DEFAULT_MENU_IMG)}" alt="${escHtml(item.nama)}" class="card-img">
                <div class="card-content">
                    <h3 class="card-title">${escHtml(item.nama)}</h3>
                    <p class="variant">${escHtml(item.variantInfo || 'S / M / XL • 3 / 6 / 16 pcs')}</p>
                    <p class="price">${escHtml(item.hargaFormatted || ('Mulai Rp' + Number(item.harga || 0).toLocaleString('id-ID')))}</p>
                </div>
                <a href="${escHtml(item.linkDetail || 'detail-menu.html')}" class="btn-pilih">+ Pilih menu</a>
            </div>
        `;
    });
    container.innerHTML = html;
    updateTampilanStokPembeli();
}

// 4. Load Popup Keranjang & Render Ulang Item saat Kembali dari Detail Menu
function renderPopupKeranjang() {
    const harusBukaPopup = localStorage.getItem('buka_popup_keranjang');
    const cartPopup = document.getElementById('cart-popup');

    let keranjang = JSON.parse(localStorage.getItem('sabangdor_cart')) || [];

    if (keranjang.length > 0 && (harusBukaPopup === 'true' || (cartPopup && !cartPopup.classList.contains('hidden')))) {
        if (cartPopup) {
            const containerItems = document.getElementById('cart-items-container');
            containerItems.innerHTML = '';

            let totalPorsiSemua = 0;
            let totalHargaSemua = 0;

            keranjang.forEach((item, index) => {
                totalPorsiSemua += item.qty;
                totalHargaSemua += item.harga;

                let catatanHtml = item.catatan
                    ? `<div class="item-catatan">Catatan: "${item.catatan}"</div>`
                    : '';

                let imageHtml = item.imgSrc
                    ? `<img src="${item.imgSrc}" alt="${item.nama}" class="cart-item-img">`
                    : `<div class="cart-item-placeholder">Menu</div>`;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                itemDiv.innerHTML = `
                    <div class="cart-item-left">
                        ${imageHtml}
                        <div class="cart-item-detail">
                            <h4 class="cart-item-title">${item.nama}</h4>
                            <div class="cart-item-variant">${item.varian}</div>
                            ${catatanHtml}
                            <div class="cart-item-price">${item.hargaFormatted || ('Rp' + item.harga.toLocaleString('id-ID'))}</div>
                        </div>
                    </div>
                    <div class="cart-item-counter">
                        <button class="cnt-btn" onclick="ubahQtyPopup(${index}, -1)">-</button>
                        <span class="cnt-num">${item.qty}</span>
                        <button class="cnt-btn plus" onclick="ubahQtyPopup(${index}, 1)">+</button>
                    </div>
                `;
                containerItems.appendChild(itemDiv);
            });

            document.getElementById('cart-badge').innerText = `${keranjang.length} Menu`;
            document.getElementById('cart-total-price').innerText = 'Rp' + totalHargaSemua.toLocaleString('id-ID');
            document.getElementById('cart-subtotal-price').innerText = 'Rp' + totalHargaSemua.toLocaleString('id-ID');
            document.getElementById('cart-subtotal-text').innerText = `Subtotal (${totalPorsiSemua} porsi)`;

            setTimeout(() => {
                cartPopup.classList.remove('hidden');
                cartPopup.classList.add('show-smooth');
            }, 100);
        }
        localStorage.removeItem('buka_popup_keranjang');
    } else if (keranjang.length === 0 && cartPopup) {
        cartPopup.classList.remove('show-smooth');
        cartPopup.classList.add('hidden');
    }
}

// 5. Fungsi Ubah Qty (+ / -) Langsung di Popup Keranjang
function ubahQtyPopup(index, delta) {
    let keranjang = JSON.parse(localStorage.getItem('sabangdor_cart')) || [];

    if (keranjang[index]) {
        let hargaSatuan = keranjang[index].harga / keranjang[index].qty;
        keranjang[index].qty += delta;

        if (keranjang[index].qty <= 0) {
            keranjang.splice(index, 1);
        } else {
            keranjang[index].harga = hargaSatuan * keranjang[index].qty;
            keranjang[index].hargaFormatted = 'Rp' + keranjang[index].harga.toLocaleString('id-ID');
        }

        localStorage.setItem('sabangdor_cart', JSON.stringify(keranjang));

        if (keranjang.length === 0) {
            kosongkanKeranjang();
        } else {
            renderPopupKeranjang();
        }
    }
}

// 6. Sinkronisasi Status Stok Habis dari Dashboard Penjual
function updateTampilanStokPembeli() {
    let menuStatus = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || [];

    document.querySelectorAll('.card-menu').forEach(card => {
        card.style.opacity = '1';
        card.style.filter = 'none';
        const btn = card.querySelector('.btn-pilih');
        if (btn && btn.innerText !== 'Habis') {
            btn.style.pointerEvents = 'auto';
        }
    });

    menuStatus.forEach(item => {
        if (item.status === 'habis') {
            const cards = document.querySelectorAll('.card-menu');
            cards.forEach(card => {
                const titleEl = card.querySelector('.card-title');
                if (titleEl && titleEl.innerText.trim().toLowerCase() === item.nama.toLowerCase()) {
                    card.style.opacity = '0.5';
                    card.style.filter = 'grayscale(100%)';

                    const btn = card.querySelector('.btn-pilih');
                    if (btn) {
                        btn.innerText = 'Habis';
                        btn.style.backgroundColor = '#94A3B8';
                        btn.style.color = '#FFFFFF';
                        btn.style.pointerEvents = 'none';
                        btn.removeAttribute('href');
                    }
                }
            });
        }
    });
}

// 7. Kosongkan Keranjang
function kosongkanKeranjang() {
    localStorage.removeItem('sabangdor_cart');
    const cartPopup = document.getElementById('cart-popup');
    if (cartPopup) {
        cartPopup.classList.remove('show-smooth');
        setTimeout(() => {
            cartPopup.classList.add('hidden');
        }, 300);
    }
}

// 8. Navigasi Tombol "Cek Keranjang"
function keHalamanKeranjang() {
    window.location.href = 'keranjang.html';
}

// 9. Trigger Rahasia Triple Click untuk Login Pegawai
function initStaffTrigger() {
    const staffTrigger = document.getElementById('staff-trigger');
    if (!staffTrigger) return;

    let clickCount = 0;
    let clickTimer = null;

    staffTrigger.addEventListener('click', () => {
        clickCount++;
        clearTimeout(clickTimer);

        if (clickCount === 3) {
            clickCount = 0;
            window.location.href = 'login-pegawai.html';
        } else {
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 800);
        }
    });
}

window.addEventListener('storage', (e) => {
    if (e.key === 'sabangdor_menu_status') {
        updateTampilanStokPembeli();
    }
    if (e.key === CUSTOM_MENU_KEY) {
        renderMenuCustom();
        updateTampilanStokPembeli();
    }
});

// 10. Menu Tambahan dari Kasir: kartu menu & tab kategori dibuat otomatis
function teksVarianCustom(menu) {
    const ukuran = menu.ukuran || [];
    const nama = ukuran.map(u => u.nama).join(' / ');
    const ket = ukuran.map(u => u.ket).filter(Boolean).join(' / ');
    return ket ? `${nama}\n${ket}` : nama;
}

function kartuMenuCustom(menu) {
    return `
        <div class="card-menu" data-custom="1">
            <img src="${menu.img || DEFAULT_MENU_IMG}" alt="${escHtml(menu.nama)}" class="card-img">
            <div class="card-content">
                <h3 class="card-title">${escHtml(menu.nama)}</h3>
                <p class="variant">${escHtml(teksVarianCustom(menu))}</p>
                <p class="price">Mulai ${rupiah(hargaMulai(menu))}</p>
            </div>
            <a href="detail-menu-custom.html?id=${encodeURIComponent(menu.id)}" class="btn-pilih">+ Pilih menu</a>
        </div>
    `;
}

function renderMenuCustom() {
    const navBar = document.querySelector('.nav-tab-bar');
    const cartPopup = document.getElementById('cart-popup');
    if (!navBar || !cartPopup) return;

    const activeSection = document.querySelector('.menu-section.active');
    const activeId = activeSection ? activeSection.id : null;
    document.querySelectorAll('[data-custom]').forEach(el => el.remove());

    const perKategori = {};
    getCustomMenus().forEach(m => {
        (perKategori[m.kategori] = perKategori[m.kategori] || []).push(m);
    });

    Object.keys(perKategori).forEach(kategori => {
        let container = null;

        if (KATEGORI_BAWAAN[kategori]) {
            const sec = document.getElementById(KATEGORI_BAWAAN[kategori]);
            container = sec ? sec.querySelector('.menu-container') : null;
        } else {
            const secId = 'section-custom-' + slugKategori(kategori);

            const tab = document.createElement('button');
            tab.className = 'tab-item';
            tab.dataset.custom = '1';
            tab.setAttribute('onclick', `pilihKategori(event, '${secId}')`);
            tab.innerHTML = `<span class="tab-label">${escHtml(kategori)}</span>`;
            if (secId === activeId) tab.classList.add('active');
            navBar.appendChild(tab);

            const sec = document.createElement('div');
            sec.id = secId;
            sec.className = 'menu-section' + (secId === activeId ? ' active' : '');
            sec.dataset.custom = '1';
            sec.innerHTML = `
                <h2 class="section-title">${escHtml(kategori)}</h2>
                <p class="section-desc"></p>
                <div class="menu-container"></div>
            `;
            cartPopup.parentNode.insertBefore(sec, cartPopup);
            container = sec.querySelector('.menu-container');
        }

        if (container) {
            perKategori[kategori].forEach(m => container.insertAdjacentHTML('beforeend', kartuMenuCustom(m)));
        }
    });

    if (activeId && !document.getElementById(activeId)) {
        const firstTab = navBar.querySelector('.tab-item');
        const firstSec = document.querySelector('.menu-section');
        navBar.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        if (firstTab) firstTab.classList.add('active');
        if (firstSec) firstSec.classList.add('active');
    }
}