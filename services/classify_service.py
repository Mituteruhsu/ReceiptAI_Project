# services/classify_service.py
from domain.enums import Category

def classify_invoice(invoice) -> Category:
    """
    將 Invoice 物件分類
    """
    text = ""
    for item in invoice.items:
        text += item.name

    # 範例 rule-based
    if "餐" in text or "食" in text:
        return Category.FOOD
    elif "衣" in text or "服" in text:
        return Category.CLOTHING
    else:
        return Category.OTHER

def test_classify():
    from domain.invoice import Invoice, Item
    invoice = Invoice(number="AA", date="2026-01-13", total=100, items=[Item(name="餐點", qty=1, price=100)])
    category = classify_invoice(invoice)
    assert category.name == "FOOD"
    print(invoice,category)

if __name__ == "__main__":
    test_classify()