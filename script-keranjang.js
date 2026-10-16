// ===== Pengaturan =====
const BACK_URL = "index.html";            // halaman menu utama
const OPEN_POPUP_ON_BACK = true;          // true = popup "Pesanan Saya" terbuka lagi saat kembali ke menu
const WHATSAPP_NUMBER = "";               // contoh: "6281234567890" (kosongkan jika tidak pakai WhatsApp)
const CART_KEY = "sabangdor_cart";        // sama dengan yang dipakai index.html & halaman detail
const POPUP_FLAG_KEY = "buka_popup_keranjang";
const MAX_QTY = 99;

// Format item di localStorage (dibuat oleh halaman detail):
// { nama, varian, catatan, imgSrc, qty, harga (total baris), hargaFormatted }

// ===== State =====
let cart = loadCart();

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter((i) => i && Number(i.qty) > 0)
      .map((i) => ({ ...i, qty: Number(i.qty), harga: Number(i.harga) || 0 }));
  } catch (e) {
    return [];
  }
}

function saveCart() {
  try {
    if (cart.length > 0) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(CART_KEY);
    }
  } catch (e) {
    /* abaikan jika storage tidak tersedia */
  }
}

// ===== Elemen =====
const $ = (id) => document.getElementById(id);
const cartList = $("cartList");
const toastEl = $("toast");

// ===== Helper =====
const formatRupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");
const totalQty = () => cart.reduce((sum, i) => sum + i.qty, 0);
const totalPrice = () => cart.reduce((sum, i) => sum + i.harga, 0);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICON_MINUS =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 6h8"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 6h8M6 2v8"/></svg>';

function itemTemplate(item, index) {
  const img = item.imgSrc
    ? `<img src="${esc(item.imgSrc)}" alt="${esc(item.nama)}" style="width:56px;height:56px;flex:none;object-fit:cover;border-radius:12px;">`
    : "";
  const note = item.catatan
    ? `<p class="item-desc" style="color:#d72c2c;">Catatan: "${esc(item.catatan)}"</p>`
    : "";

  return `
    <li class="item" data-index="${index}">
      <div class="item-info" style="display:flex;align-items:center;gap:12px;">
        ${img}
        <div style="min-width:0;">
          <p class="item-name">${esc(item.nama)}</p>
          <p class="item-desc">${esc(item.varian)}</p>
          ${note}
          <p class="item-price">${formatRupiah(item.harga)}</p>
        </div>
      </div>
      <div class="stepper">
        <button class="step-btn" type="button" data-action="dec" aria-label="Kurangi ${esc(item.nama)}">${ICON_MINUS}</button>
        <span class="qty" aria-live="polite">${item.qty}</span>
        <button class="step-btn" type="button" data-action="inc" aria-label="Tambah ${esc(item.nama)}">${ICON_PLUS}</button>
      </div>
    </li>`;
}

// ===== Render =====
function render() {
  const isEmpty = cart.length === 0;
  const total = formatRupiah(totalPrice());

  cartList.innerHTML = cart.map(itemTemplate).join("");

  $("cartEmpty").hidden = !isEmpty;
  $("summary").hidden = isEmpty;
  $("clearBtn").hidden = isEmpty;

  $("cartCount").textContent = totalQty() + " porsi";
  $("cartSubtotal").textContent = total;
  $("cartTotal").textContent = total;
  $("checkoutBtn").disabled = isEmpty;

  saveCart();
}

// ===== Ubah jumlah =====
function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;

  const next = item.qty + delta;
  if (next > MAX_QTY) return;

  if (next <= 0) {
    cart.splice(index, 1); // hapus item jika jumlah 0
  } else {
    const unitPrice = item.harga / item.qty;
    item.qty = next;
    item.harga = Math.round(unitPrice * next);
    item.hargaFormatted = formatRupiah(item.harga);
  }
  render();
}

cartList.addEventListener("click", (e) => {
  const btn = e.target.closest(".step-btn");
  if (!btn) return;
  const index = Number(btn.closest(".item").dataset.index);
  changeQty(index, btn.dataset.action === "inc" ? 1 : -1);
});

// ===== Navigasi =====
function goBack() {
  try {
    if (OPEN_POPUP_ON_BACK && cart.length > 0) {
      localStorage.setItem(POPUP_FLAG_KEY, "true");
    }
  } catch (e) {
    /* abaikan */
  }
  window.location.href = BACK_URL;
}

$("backBtn").addEventListener("click", goBack);
$("emptyBackBtn").addEventListener("click", goBack);

// ===== Kosongkan =====
$("clearBtn").addEventListener("click", () => {
  cart = [];
  render();
  showToast("Keranjang dikosongkan");
});

// ===== Pesan sekarang =====
$("checkoutBtn").addEventListener("click", () => {
  if (cart.length === 0) return;

  const lines = cart.map((i) => {
    const catatan = i.catatan ? ` (Catatan: ${i.catatan})` : "";
    return `${i.qty}x ${i.nama} - ${i.varian}${catatan} = ${formatRupiah(i.harga)}`;
  });
  const pesan = `Pesanan Sabangdor (ambil di outlet)\n${lines.join("\n")}\nTotal: ${formatRupiah(totalPrice())}`;
  const total = formatRupiah(totalPrice());

  if (WHATSAPP_NUMBER) {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(pesan)}`, "_blank");
  } else {
    console.log(pesan);
  }

  cart = [];
  render();
  showToast("Pesanan dikirim. Total " + total);
});

// ===== Toast =====
let toastTimer;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ===== Mulai =====
render();