# services/classify_service.py
from domain.enums import Category
from domain.invoice import Invoice, Item


# =========================
# 分類關鍵字規則表
# =========================

CATEGORY_KEYWORDS = {
    Category.FOOD: [
        "蛋", "飯", "麵", "肉", "飲", "可樂", "咖啡", "茶"
    ],
    Category.HOUSHOLD_GOODS: [
        "衛生紙", "清潔", "洗", "杯", "袋"
    ],
    Category.MEDICAL: [
        "藥", "口罩", "酒精"
    ],
    Category.TRANSPORT: [
        "油", "停車", "車"
    ],
}


# =========================
# 單品項分類-可以升級成AI分類
# =========================

def classify_item(item: Item) -> Category:
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in item.name:
                return category
    return Category.OTHER


# =========================
# 整張發票分類
# =========================

def classify_invoice(invoice: Invoice) -> dict:
    """
    回傳：
    {
        category: Category,
        items: [(Item, Category)]
    }
    """

    result = []
    category_count = {}

    for item in invoice.items:
        cat = classify_item(item)
        result.append((item, cat))
        category_count[cat] = category_count.get(cat, 0) + 1

    # 以最多品項的分類為主分類
    main_category = max(category_count, key=category_count.get) if category_count else Category.OTHER

    return {
        "main_category": main_category,
        "items": result
    }


# =========================
# 可執行測試（非語法糖）
# =========================

def test_classify_service():
    items = [
        Item(name="野川蛋黃派10粒", qty=1, price=65),
        Item(name="可口可樂1250CC", qty=1, price=38),
    ]

    invoice = Invoice(
        number="DF62269413",
        date="2022-07-08",
        total=103,
        items=items,
        invoice_type=None
    )

    result = classify_invoice(invoice)

    print("=== Classification Result ===")
    print("Main Category:", result["main_category"].value)
    for item, cat in result["items"]:
        print(f"- {item.name} → {cat.value}")


if __name__ == "__main__":
    test_classify_service()

# 可執行測試指令
# python -m services.classify_service