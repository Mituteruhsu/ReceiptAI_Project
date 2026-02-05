# services/ocr/ocr_eng_digits.py
from services.ocr.base import BaseOCR, OCRResult
import pytesseract
from PIL import Image

class EngDigitsOCR(BaseOCR):
    """
    OCR-B
    用於：金額 / 日期 / 發票號碼
    """
    def extract(self, image) -> OCRResult:
        text = self._run_ocr(image)
        return OCRResult(text=text, source="ocr_b")

    def _run_ocr(self, image: Image.Image) -> str:
        print("services/ocr/ocr_eng_digits.py EngDigitsOCR._run_ocr()")
        print("text ocr-b:", pytesseract.image_to_string(
            image,
            lang='eng+digits',
            config='--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/'
            ))
        return pytesseract.image_to_string(
            image,
            lang='eng+digits',
            config='--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/'
            )
