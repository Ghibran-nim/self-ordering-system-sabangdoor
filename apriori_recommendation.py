
import os

import pandas as pd
from dotenv import load_dotenv
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from supabase import create_client


PAGE_SIZE = 1000
MIN_SUPPORT = 0.01
MIN_CONFIDENCE = 0.20
TOP_N = 5

# Sesuaikan dengan nilai status pesanan di database Anda.
VALID_STATUSES = {"completed", "selesai"}


def fetch_all(supabase, table, columns):
    """Ambil semua baris menggunakan pagination."""
    rows = []
    start = 0

    while True:
        response = (
            supabase.table(table)
            .select(columns)
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )

        batch = response.data or []
        rows.extend(batch)

        if len(batch) < PAGE_SIZE:
            break

        start += PAGE_SIZE

    return pd.DataFrame(rows)


def fetch_transaction_data(supabase):
    """Gabungkan detail pesanan dengan nama menu dan status pesanan."""
    items = fetch_all(
        supabase,
        "order_items",
        "id_order,id_menu,jumlah",
    )

    orders = fetch_all(
        supabase,
        "orders",
        "id_order,status_pesanan",
    )

    menus = fetch_all(
        supabase,
        "menus",
        "id_menu,nama_dimsum",
    )

    if items.empty or orders.empty or menus.empty:
        raise ValueError("Data pesanan, detail pesanan, atau menu kosong.")

    # Hubungkan detail item dengan status pesanan.
    data = items.merge(
        orders,
        on="id_order",
        how="inner",
        validate="many_to_one",
    )

    # Hubungkan ID menu dengan nama makanan.
    data = data.merge(
        menus,
        on="id_menu",
        how="inner",
        validate="many_to_one",
    )

    # Hanya gunakan pesanan yang selesai.
    # Periksa kembali nilai status di database Anda.
    if VALID_STATUSES:
        data = data[
            data["status_pesanan"]
            .astype(str)
            .str.strip()
            .str.lower()
            .isin(VALID_STATUSES)
        ]

    data = data.dropna(
        subset=["id_order", "nama_dimsum"]
    ).copy()

    data["nama_dimsum"] = (
        data["nama_dimsum"].astype(str).str.strip()
    )

    data = data[data["nama_dimsum"] != ""]

    return data


def train_rules(data):
    """Pelajari pola kombinasi makanan dari setiap transaksi."""
    if data.empty:
        raise ValueError(
            "Tidak ada transaksi valid. Periksa status pesanan."
        )

    baskets = (
        data.groupby("id_order")["nama_dimsum"]
        .apply(lambda items: sorted(set(items)))
        .tolist()
    )

    baskets = [basket for basket in baskets if basket]

    if len(baskets) < 2:
        raise ValueError(
            "Minimal dua transaksi diperlukan untuk analisis."
        )

    encoder = TransactionEncoder()
    encoded = encoder.fit(baskets).transform(baskets)

    basket_matrix = pd.DataFrame(
        encoded,
        columns=encoder.columns_,
    )

    frequent_itemsets = apriori(
        basket_matrix,
        min_support=MIN_SUPPORT,
        use_colnames=True,
    )

    if frequent_itemsets.empty:
        raise ValueError(
            "Tidak ditemukan kombinasi. "
            "Turunkan MIN_SUPPORT atau tambah transaksi."
        )

    rules = association_rules(
        frequent_itemsets,
        metric="confidence",
        min_threshold=MIN_CONFIDENCE,
    )

    return rules


def recommend(rules, current_items, top_n=TOP_N):
    """Rekomendasikan menu berdasarkan isi keranjang."""
    current_items = set(current_items)
    candidates = {}

    for _, rule in rules.iterrows():
        antecedents = set(rule["antecedents"])
        consequents = set(rule["consequents"])

        if not antecedents.issubset(current_items):
            continue

        for food in consequents - current_items:
            scores = candidates.setdefault(
                food,
                {"confidence": 0.0, "lift": 0.0,
                 "support": 0.0},
            )

            scores["confidence"] = max(
                scores["confidence"],
                float(rule["confidence"]),
            )
            scores["lift"] = max(
                scores["lift"], float(rule["lift"])
            )
            scores["support"] = max(
                scores["support"], float(rule["support"])
            )

    ranked = sorted(
        candidates.items(),
        key=lambda item: (
            item[1]["confidence"],
            item[1]["lift"],
        ),
        reverse=True,
    )

    return [
        {
            "nama_dimsum": food,
            "confidence": round(scores["confidence"], 3),
            "lift": round(scores["lift"], 3),
            "support": round(scores["support"], 3),
        }
        for food, scores in ranked[:top_n]
    ]


def main():
    load_dotenv()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL dan SUPABASE_KEY harus tersedia."
        )

    supabase = create_client(url, key)

    data = fetch_transaction_data(supabase)

    print("Jumlah detail item:", len(data))
    print("Jumlah transaksi:", data["id_order"].nunique())

    rules = train_rules(data)

    # Contoh. Gunakan nama yang persis sama dengan tabel menus.
    cart = ["Dimsum Mentai Ori - S (3pcs)"]

    recommendations = recommend(rules, cart)

    print("\nRekomendasi untuk keranjang:", cart)

    if not recommendations:
        print("Belum ada rekomendasi untuk kombinasi ini.")

    for item in recommendations:
        print(
            f"- {item['nama_dimsum']} "
            f"(confidence={item['confidence']}, "
            f"lift={item['lift']}, "
            f"support={item['support']})"
        )


if __name__ == "__main__":
    main()