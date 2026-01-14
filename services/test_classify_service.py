# tests/test_classify_service.py
import unittest

from services.classify_service import classify_invoice
from domain.invoice import Invoice, Item
from domain.enums import Category


class TestClassifier(unittest.TestCase):

    def test_classify_food(self):
        invoice = Invoice(
            number="AA",
            date="2026-01-13",
            total=100,
            items=[Item(name="餐點", qty=1, price=100)]
        )
        category = classify_invoice(invoice)
        self.assertEqual(category, Category.FOOD)
        print("Classified category:", category)

    def test_classify_clothing(self):
        invoice = Invoice(
            number="BB",
            date="2026-01-13",
            total=200,
            items=[Item(name="衣服", qty=2, price=100)]
        )
        category = classify_invoice(invoice)
        self.assertEqual(category, Category.CLOTHING)
        print("Classified category:", category)


if __name__ == "__main__":
    unittest.main()

# 單一測試檔案執行
# python -m unittest services.test_classify_service

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"
