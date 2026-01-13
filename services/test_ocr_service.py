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
