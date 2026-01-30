# services/test_invoice_parser.py
from django.test import TestCase
from services.invoice_parser import InvoiceParser

class InvoiceParserTestCase(TestCase):
    
    def test_parse_qr_header(self):
        """測試解析 QR Header"""
        qr_strings = [
            "DF622694131110708397000000003000000030000000008547587XKsayZY706hvyFpe6k3TQ==",
        ]
        
        result = InvoiceParser.parse_qr(qr_strings)
        
        self.assertEqual(result['number'], 'DF62269413')
        self.assertEqual(result['date'], '2022-07-08')
        self.assertEqual(result['total'], 30)
    
    def test_parse_qr_with_items(self):
        """測試解析包含品項的 QR"""
        qr_strings = [
            "DF622694131110708397000000003000000030000000008547587XKsayZY706hvyFpe6k3TQ==",
            "**********:2:2:1:野川蛋黃派10粒:1:65:可口可樂1250CC:1:38"
        ]
        
        result = InvoiceParser.parse_qr(qr_strings)
        
        self.assertEqual(len(result['items']), 2)
        self.assertEqual(result['items'][0]['name'], '野川蛋黃派10粒')
        self.assertEqual(result['items'][0]['qty'], 1)
        self.assertEqual(result['items'][0]['price'], 65)
    
    def test_parse_ocr(self):
        """測試 OCR 解析"""
        text = """
        發票號碼: BB87654321
        日期: 111年7月8日
        總計: 800元
        """
        
        result = InvoiceParser.parse_ocr(text)
        
        self.assertEqual(result['number'], 'BB87654321')
        self.assertIn('2022', result['date'])
        self.assertEqual(result['total'], 800)

# 單一測試檔案執行
# python -m unittest services.test_invoice_parser

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"
