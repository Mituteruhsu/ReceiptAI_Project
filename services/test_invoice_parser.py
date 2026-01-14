# tests/test_invoice_parser.py
import unittest
from services.invoice_parser import parse_qr, parse_ocr

class TestInvoiceParser(unittest.TestCase):

    def test_parse_qr(self):
        invoice = parse_qr("AA12345678|2026-01-13|500")
        self.assertEqual(invoice.number, "AA12345678")
        self.assertEqual(invoice.total, 500)
        print("Parsed QR Invoice:", invoice.__dict__)

    def test_parse_ocr(self):
        raw_text = "發票號碼: BB87654321 金額: 800"
        invoice = parse_ocr(raw_text)
        self.assertEqual(invoice.number, "BB87654321")
        self.assertEqual(invoice.total, 800)
        print("Parsed OCR Invoice:", invoice.__dict__)

if __name__ == "__main__":
    unittest.main()

# 單一測試檔案執行
# python -m unittest services.test_invoice_parser

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"