# tests/test_classify_service.py
import unittest
from classify_service import classify_invoice
from domain.invoice import Invoice, Item
from domain.enums import Category

class TestClassifier(unittest.TestCase):

    def test_classify_food(self):
        invoice = Invoice(number="AA", date="2026-01-13", total=100,
                          items=[Item(name="餐點", qty=1, price=100)])
        category = classify_invoice(invoice)
        self.assertEqual(category, Category.FOOD)
        print("Classified category:", category)

    def test_classify_clothing(self):
        invoice = Invoice(number="BB", date="2026-01-13", total=200,
                          items=[Item(name="衣服", qty=2, price=100)])
        category = classify_invoice(invoice)
        self.assertEqual(category, Category.CLOTHING)
        print("Classified category:", category)

if __name__ == "__main__":
    unittest.main()
