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

// 2. Load Popup Keranjang & Render Ulang Item saat Kembali dari Detail Menu
window.addEventListener('DOMContentLoaded', () => {
    updateTampilanStokPembeli();
    renderPopupKeranjang();
    initStaffTrigger();
});

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

            // Tampilkan popup dengan animasi smooth slide-up
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

// 3. Fungsi Ubah Qty (+ / -) Langsung di Popup Keranjang
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

// 4. Sinkronisasi Status Stok Habis dari Dashboard Penjual
function updateTampilanStokPembeli() {
    let menuStatus = JSON.parse(localStorage.getItem('sabangdor_menu_status')) || [];

    // Reset dahulu semua kartu menu ke kondisi awal/aktif
    document.querySelectorAll('.card-menu').forEach(card => {
        card.style.opacity = '1';
        card.style.filter = 'none';
        const btn = card.querySelector('.btn-pilih');
        if (btn) {
            btn.innerText = '+ Pilih menu';
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.pointerEvents = 'auto';
        }
    });

    // Terapkan efek 'Habis' untuk menu yang di-set habis oleh penjual
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
                        btn.style.pointerEvents = 'none'; // Matikan klik
                        btn.removeAttribute('href');
                    }
                }
            });
        }
    });
}

// 5. Kosongkan Keranjang
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

// 6. Navigasi Tombol "Cek Keranjang" ke Halaman Teman
function keHalamanKeranjang() {
    window.location.href = 'keranjang.html';
}

// 7. Trigger Rahasia Triple Click untuk Login Pegawai
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

// Memantau perubahan localStorage secara real-time saat kedua tab terbuka
window.addEventListener('storage', (e) => {
    if (e.key === 'sabangdor_menu_status') {
        updateTampilanStokPembeli();
    }
});