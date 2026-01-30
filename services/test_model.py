# services/test_models.py
from django.test import TestCase
from domain.models import Invoice, Item
from domain.enums import InvoiceType, Category
from datetime import date

class InvoiceModelTestCase(TestCase):
    
    def test_create_invoice(self):
        """測試建立發票"""
        invoice = Invoice.objects.create(
            number='AA12345678',
            date=date(2022, 7, 8),
            total=100.00,
            invoice_type=InvoiceType.QR.value,
            category=Category.FOOD.value
        )
        
        self.assertEqual(invoice.number, 'AA12345678')
        self.assertFalse(invoice.is_confirmed)
    
    def test_invoice_with_items(self):
        """測試發票與品項關聯"""
        invoice = Invoice.objects.create(
            number='BB88888888',
            date=date(2022, 7, 8),
            total=0
        )
        
        Item.objects.create(
            invoice=invoice,
            name='測試商品',
            quantity=2,
            unit_price=50
        )
        
        self.assertEqual(invoice.items.count(), 1)
        self.assertEqual(invoice.items_total, 100)


# 執行測試指令
# python manage.py test clients
# python manage.py test models
# python manage.py test  # 執行所有測試

# ==========================================

# 單一測試檔案執行
# python -m unittest services.test_invoice_parser

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"