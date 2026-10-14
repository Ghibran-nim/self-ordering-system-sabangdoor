document.addEventListener('DOMContentLoaded', function () {
    // 1. Ambil semua elemen HTML yang dibutuhkan
    const sizeBoxes = document.querySelectorAll('.size-box');
    const minusBtn = document.querySelector('.qty-btn.minus');
    const plusBtn = document.querySelector('.qty-btn.plus');
    const qtyValueEl = document.querySelector('.qty-value');
    const priceRowSpans = document.querySelectorAll('.price-row span');
    const totalPriceEl = document.querySelector('.total-price');
    const footerMetaEl = document.querySelector('.footer-meta span');
    const qtyPcsInfoEl = document.querySelector('.qty-pcs-info');
    const checkboxes = document.querySelectorAll('.checkbox-custom');

    // Variable State
    let currentQty = 1;
    let basePrice = 0;
    let currentPcsText = '6 pcs';

    // Helper: Mengubah string Rupiah (contoh "Rp18.000") menjadi angka integer (18000)
    function parseRupiah(text) {
        if (!text) return 0;
        return parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    }

    // Helper: Mengubah angka integer (18000) menjadi format Rupiah ("Rp18.000")
    function formatRupiah(number) {
        return 'Rp' + number.toLocaleString('id-ID');
    }

    // Fungsi Utama: Menghitung ulang seluruh total harga & tampilan teks
    function updateCalculations() {
        // A. Hitung total harga tambahan opsional (Checkbox)
        let addonTotal = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const addonItem = cb.closest('.addon-item');
                if (addonItem) {
                    const priceText = addonItem.querySelector('.addon-price').innerText;
                    addonTotal += parseRupiah(priceText);
                }
            }
        });

        // B. Hitung harga per 1 porsi (Harga Dasar Porsi + Addon)
        const pricePerUnit = basePrice + addonTotal;

        // C. Hitung Total Keseluruhan (Harga per Porsi x Jumlah Porsi)
        const grandTotal = pricePerUnit * currentQty;

        // D. Update Teks Tampilan Jumlah Porsi
        if (qtyValueEl) {
            qtyValueEl.innerText = `${currentQty} porsi`;
        }

        // E. Update Tabel Rincian Harga
        if (priceRowSpans.length >= 4) {
            priceRowSpans[1].innerText = formatRupiah(pricePerUnit); // Harga porsi (+ addon jika ada)
            priceRowSpans[2].innerText = `Subtotal × ${currentQty} porsi`; // Teks Subtotal
            priceRowSpans[3].innerText = formatRupiah(grandTotal); // Total Subtotal
        }

        // F. Update Teks Sticky Footer
        if (totalPriceEl) {
            totalPriceEl.innerText = formatRupiah(grandTotal);
        }
        if (footerMetaEl) {
            footerMetaEl.innerText = `${currentQty} porsi • ${currentPcsText}`;
        }
        if (qtyPcsInfoEl) {
            qtyPcsInfoEl.innerText = `${currentPcsText}/porsi`;
        }
    }

    // Fungsi untuk inisialisasi data dari porsi yang sedang aktif (.active)
    function initActiveSize() {
        const activeBox = document.querySelector('.size-box.active') || sizeBoxes[0];
        if (activeBox) {
            basePrice = parseRupiah(activeBox.querySelector('.size-price').innerText);
            currentPcsText = activeBox.querySelector('.size-pcs').innerText;
        }
    }

    // --- EVENT LISTENERS ---

    // 2. Event Listener: Klik Opsi Ukuran Porsi (S, M, XL)
    sizeBoxes.forEach(box => {
        box.addEventListener('click', function () {
            sizeBoxes.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            basePrice = parseRupiah(this.querySelector('.size-price').innerText);
            currentPcsText = this.querySelector('.size-pcs').innerText;

            updateCalculations();
        });
    });

    // 3. Event Listener: Tombol Plus (Increment)
    if (plusBtn) {
        plusBtn.addEventListener('click', function () {
            currentQty++;
            updateCalculations();
        });
    }

    // 4. Event Listener: Tombol Minus (Decrement)
    if (minusBtn) {
        minusBtn.addEventListener('click', function () {
            if (currentQty > 1) { // Batas minimal 1 porsi
                currentQty--;
                updateCalculations();
            }
        });
    }

    // 5. Event Listener: Checkbox Tambahan Opsional
    checkboxes.forEach(cb => {
        cb.addEventListener('change', function () {
            updateCalculations();
        });
    });

    // Jalankan kalkulasi pertama kali saat halaman di-load
    initActiveSize();
    updateCalculations();    

const cartBtn = document.querySelector('.cart-btn');
if (cartBtn) {
    cartBtn.addEventListener('click', function () {
        const namaProduk = document.querySelector('.product-info h2').innerText;
        
        // --- AMBIL LINK GAMBAR DARI HALAMAN DETAIL ---
        const productImageEl = document.querySelector('.product-banner img');
        const produkImgSrc = productImageEl ? productImageEl.src : '';

        const activeSizeBox = document.querySelector('.size-box.active');
        const ukuranPorsi = activeSizeBox ? activeSizeBox.querySelector('.size-name').innerText : 'M';
        const pcsInfo = activeSizeBox ? activeSizeBox.querySelector('.size-pcs').innerText : '6 pcs';
        
        let daftarAddon = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const addonItem = cb.closest('.addon-item');
                if (addonItem) {
                    const addonName = addonItem.querySelector('.addon-label span').innerText;
                    daftarAddon.push(addonName);
                }
            }
        });

        const inputCatatan = document.querySelector('.note-input-box input');
        const catatanTeks = inputCatatan ? inputCatatan.value.trim() : '';

        const totalHargaText = totalPriceEl ? totalPriceEl.innerText : 'Rp26.000';
        const hargaAngka = parseRupiah(totalHargaText);
        const jumlahPorsi = currentQty || 1;

        let detailVarianText = `${ukuranPorsi} (${pcsInfo})`;
        if (daftarAddon.length > 0) {
            detailVarianText += ` + ${daftarAddon.join(', ')}`;
        }

        const itemBaru = {
            nama: namaProduk,
            varian: detailVarianText,
            catatan: catatanTeks,
            qty: jumlahPorsi,
            harga: hargaAngka,
            hargaFormatted: totalHargaText,
            imgSrc: produkImgSrc // Menyimpan link gambar
        };

        let keranjang = JSON.parse(localStorage.getItem('sabangdor_cart')) || [];
        keranjang.push(itemBaru);

        localStorage.setItem('sabangdor_cart', JSON.stringify(keranjang));
        localStorage.setItem('buka_popup_keranjang', 'true');

        window.location.href = 'index.html';
    });
}
});