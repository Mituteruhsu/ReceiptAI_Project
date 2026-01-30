# service/test_classify_service.py
from django.test import TestCase
from services.classify_service import InvoiceClassifier

class InvoiceClassifierTestCase(TestCase):
    
    def test_classify_food(self):
        """測試飲食分類"""
        data = {
            'items': [
                {'name': '可口可樂', 'qty': 1, 'price': 38},
                {'name': '野川蛋黃派', 'qty': 1, 'price': 65},
            ]
        }
        
        result = InvoiceClassifier.classify(data)
        
        self.assertEqual(result['main_category'], '飲食')
        self.assertEqual(result['items'][0]['category'], '飲食')
    
    def test_classify_transport(self):
        """測試交通分類"""
        data = {
            'items': [
                {'name': '停車費', 'qty': 1, 'price': 50},
            ]
        }
        
        result = InvoiceClassifier.classify(data)
        
        self.assertEqual(result['main_category'], '行(交通費/油錢)')


# 單一測試檔案執行
# python -m unittest services.test_invoice_parser

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"
