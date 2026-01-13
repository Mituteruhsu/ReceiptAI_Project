from invoice import Invoice, Item
from enums import InvoiceType, Category, SubCategory

def test_invoice_creation():
    item1 = Item(name="餐廳", qty=2, price=150, category=Category.FOOD, sub_category=SubCategory.RESTAURANT)
    invoice = Invoice(number="AA12345678", date="2026-01-13", total=0, items=[], invoice_type=InvoiceType.QR)
    invoice.add_item(item1)

    assert invoice.total == 300
    assert invoice.items[0].name == "餐廳"
    assert invoice.items[0].category == Category.FOOD
    assert invoice.items[0].sub_category == SubCategory.RESTAURANT

if __name__ == "__main__":
    test_invoice_creation()
    print("Step 1 Domain test passed!")
