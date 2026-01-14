# tests/test_ocr_service.py
import unittest
from ocr_service import extract_text

class TestOCRService(unittest.TestCase):

    def test_extract_text(self):
        text = extract_text("recive20220708.jpg")
        self.assertTrue(len(text) > 0)
        print("OCRService output:", text)

if __name__ == "__main__":
    unittest.main()

# 單一測試檔案執行
# python -m unittest services.test_ocr_service

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"