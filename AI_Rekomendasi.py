import os
from collections import defaultdict

import pandas as pd
from dotenv import load_dotenv
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from supabase import create_client


# Sesuaikan dengan tabel dan kolom pada database Anda
TABLE_NAME = "order_items"
ORDER_ID_COLUMN = "order_id"
FOOD_NAME_COLUMN = "food_name"

PAGE_SIZE = 1000
MIN_SUPPORT = 0.01
MIN_CONFIDENCE = 0.20
TOP_N = 5


def fetch_order_items(supabase):
    """Ambil data transaksi bertahap agar tidak berhenti di batas jumlah baris API."""
    rows = []
    start = 0

    while True:
        response = (
            supabase.table(TABLE_NAME)
            .select(f"{ORDER_ID_COLUMN},{FOOD_NAME_COLUMN}")
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )

        batch = response.data or []
        rows.extend(batch)

        if len(batch) < PAGE_SIZE:
            break

        start += PAGE_SIZE

    return pd.DataFrame(rows)


def train_rules(df):
    """Ubah baris item menjadi keranjang transaksi dan hitung aturan asosiasi."""
    required_columns = {ORDER_ID_COLUMN, FOOD_NAME_COLUMN}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Kolom tidak ditemukan pada hasil query: {sorted(missing)}")

    df = df.dropna(subset=[ORDER_ID_COLUMN, FOOD_NAME_COLUMN]).copy()
    df[FOOD_NAME_COLUMN] = df[FOOD_NAME_COLUMN].astype(str).str.strip()
    df = df[df[FOOD_NAME_COLUMN] != ""]

    baskets = (
        df.groupby(ORDER_ID_COLUMN)[FOOD_NAME_COLUMN]
        .apply(lambda items: sorted(set(items)))
        .tolist()
    )
    baskets = [basket for basket in baskets if basket]

    if len(baskets) < 2:
        raise ValueError("Data transaksi belum cukup untuk membuat aturan asosiasi.")

    encoder = TransactionEncoder()
    encoded = encoder.fit(baskets).transform(baskets)
    basket_matrix = pd.DataFrame(encoded, columns=encoder.columns_)

    frequent_itemsets = apriori(
        basket_matrix,
        min_support=MIN_SUPPORT,
        use_colnames=True,
    )

    if frequent_itemsets.empty:
        raise ValueError(
            "Tidak ditemukan kombinasi item. Coba turunkan MIN_SUPPORT "
            "atau tambahkan data transaksi."
        )

    rules = association_rules(
        frequent_itemsets,
        metric="confidence",
        min_threshold=MIN_CONFIDENCE,
    )

    return rules


def recommend(rules, current_items, top_n=TOP_N):
    """Rekomendasikan makanan berdasarkan makanan yang sudah ada di keranjang."""
    current_items = set(current_items)
    candidates = defaultdict(lambda: {"confidence": 0.0, "lift": 0.0, "support": 0.0})

    for _, rule in rules.iterrows():
        antecedents = set(rule["antecedents"])
        consequents = set(rule["consequents"])

        # Gunakan aturan jika semua makanan pemicunya ada di keranjang.
        if not antecedents.issubset(current_items):
            continue

        for food in consequents - current_items:
            item = candidates[food]
            item["confidence"] = max(item["confidence"], float(rule["confidence"]))
            item["lift"] = max(item["lift"], float(rule["lift"]))
            item["support"] = max(item["support"], float(rule["support"]))

    ranked = sorted(
        candidates.items(),
        key=lambda pair: (pair[1]["confidence"], pair[1]["lift"]),
        reverse=True,
    )

    return [
        {
            "food": food,
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
        raise RuntimeError("SUPABASE_URL dan SUPABASE_KEY harus disetel di environment.")

    supabase = create_client(url, key)
    data = fetch_order_items(supabase)

    if data.empty:
        raise ValueError("Tabel transaksi tidak mengembalikan data.")

    rules = train_rules(data)

    # Contoh: makanan yang sudah ada di keranjang pelanggan
    cart = ["Nasi Goreng"]
    recommendations = recommend(rules, cart)

    print(f"Rekomendasi untuk keranjang {cart}:")
    for item in recommendations:
        print(
            f"- {item['food']} "
            f"(confidence={item['confidence']}, lift={item['lift']})"
        )


if __name__ == "__main__":
    main()