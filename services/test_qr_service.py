# # tests/test_qr_service.py
# import unittest
# from services.qr_service import decode_qr

# class TestQRService(unittest.TestCase):

#     def test_decode_qr(self):
#         # 假設 tests/sample_qr.png 是有效 QRCode 圖片
#         result = decode_qr("recive20220708.jpg")
#         self.assertIn("raw_qr", result)
#         print("QRService output:", result)

# if __name__ == "__main__":
#     unittest.main()

# 單一測試檔案執行
# python -m unittest services.test_qr_service

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from services.qr_service import decode_qr


if __name__ == "__main__":
    result = decode_qr("recive20220708.jpg")

    print("=== QR Scan Result ===")
    for idx, qr in enumerate(result["raw_qrs"], start=1):
        print(f"\n[QR #{idx}]")
        print(qr)
