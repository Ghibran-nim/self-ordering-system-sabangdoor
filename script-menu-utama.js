// Fungsi untuk memindahkan section menu ke atas dengan animasi bergulir halus
function pilihKategori(event, targetId) {
    event.preventDefault();

    const clickedButton = event.currentTarget;
    const categoryContainer = document.getElementById('category-container');

    // 1. Hilangkan kelas 'active' dari semua tombol, lalu aktifkan yang diklik
    const semuaTombol = categoryContainer.querySelectorAll('.category-makanan-button');
    semuaTombol.forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');

    // 2. Geser tombol yang diklik ke posisi paling depan (pertama)
    categoryContainer.prepend(clickedButton);

    // 3. Ambil elemen section menu yang dituju
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
        // Pindahkan section tersebut ke urutan paling atas di bawah tombol kategori
        categoryContainer.after(targetSection);

        // 4. Berikan efek gulir (scroll) halus ke arah section tersebut
        // Menggunakan block: 'start' agar section yang baru pindah langsung bergulir mulus ke atas layar
        targetSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 2. Mengecek apakah ada pesanan dari halaman detail (saat pengguna dikembalikan ke dashboard)
window.addEventListener('DOMContentLoaded', () => {
    const harusBukaPopup = localStorage.getItem('buka_popup_keranjang');

    if (harusBukaPopup === 'true') {
        const cartPopup = document.getElementById('cart-popup');
        
        if (cartPopup) {
            cartPopup.classList.remove('hidden');
            
            // Ambil data array keranjang dari localStorage
            let keranjang = JSON.parse(localStorage.getItem('sabangdor_cart')) || [];
            
            const containerItems = document.getElementById('cart-items-container');
            containerItems.innerHTML = ''; // Bersihkan kontainer sebelum diisi

            let totalPorsiSemua = 0;
            let totalHargaSemua = 0;

            if (keranjang.length > 0) {
                keranjang.forEach((item, index) => {
                totalPorsiSemua += item.qty;
                totalHargaSemua += item.harga;

                let catatanHtml = item.catatan ? `<span class="item-variant" style="color: #D72C2C;">Catatan: "${item.catatan}"</span>` : '';
    
                // Tentukan apakah menggunakan gambar asli atau placeholder teks jika gambar kosong
                let imageHtml = item.imgSrc 
                    ? `<img src="${item.imgSrc}" alt="${item.nama}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 10px;">`
                    : `<div class="item-img-placeholder">Menu</div>`;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                itemDiv.innerHTML = `
                    <div class="item-left">
                        ${imageHtml}
                        <div class="item-detail">
                            <h4>${item.nama}</h4>
                            <span class="item-variant">${item.varian}</span>
                            ${catatanHtml}
                            <div class="item-price">${item.hargaFormatted}</div>
                        </div>
                    </div>
                    <div class="item-counter">
                        <button class="cnt-btn" onclick="ubahQty(${index}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="cnt-btn plus" onclick="ubahQty(${index}, 1)">+</button>
                    </div>
                `;
                containerItems.appendChild(itemDiv);
            });

                // Update badge jumlah jenis menu & total harga
                document.getElementById('cart-badge').innerText = `${keranjang.length} Menu`;
                document.getElementById('cart-total-price').innerText = 'Rp' + totalHargaSemua.toLocaleString('id-ID');
                document.getElementById('cart-subtotal-price').innerText = 'Rp' + totalHargaSemua.toLocaleString('id-ID');
                document.getElementById('cart-subtotal-text').innerText = `Subtotal (${totalPorsiSemua} porsi)`;
            }
        }

        // Hapus flag agar tidak otomatis buka terus saat direfresh manual
        localStorage.removeItem('buka_popup_keranjang');
    }
});

// Fungsi tambahan untuk tombol plus/minus langsung di dalam popup keranjang (Opsional tapi fungsional)
function ubahQty(index, delta) {
    let keranjang = JSON.parse(localStorage.getItem('sabangdor_cart')) || [];
    if (keranjang[index]) {
        keranjang[index].qty += delta;
        
        // Hitung ulang harga satuan dasarnya berdasarkan total dibagi qty lama
        let satuanHarga = keranjang[index].harga / (keranjang[index].qty - delta);
        keranjang[index].harga = satuanHarga * keranjang[index].qty;
        keranjang[index].hargaFormatted = 'Rp' + keranjang[index].harga.toLocaleString('id-ID');

        if (keranjang[index].qty <= 0) {
            keranjang.splice(index, 1); // Hapus jika qty 0
        }

        localStorage.setItem('sabangdor_cart', JSON.stringify(keranjang));
        localStorage.setItem('buka_popup_keranjang', 'true');
        location.reload(); // Refresh halaman untuk render ulang popup
    }
}

// Fungsi tombol 'Hapus semua'
function kosongkanKeranjang() {
    localStorage.removeItem('sabangdor_cart');
    const cartPopup = document.getElementById('cart-popup');
    if (cartPopup) {
        cartPopup.classList.add('hidden');
    }
}

// 4. Fungsi tombol 'Cek Keranjang' ke halaman keranjang teman
function keHalamanKeranjang() {
    window.location.href = 'keranjang.html';
}