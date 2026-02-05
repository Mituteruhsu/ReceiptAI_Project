# services/ocr/ocr_chi_eng.py
from services.ocr.base import BaseOCR, OCRResult
import pytesseract
from PIL import Image

class ChiEngOCR(BaseOCR):
    """
    OCR-A
    用於：店名 / 品項 / 中文內容
    """
    def extract(self, image) -> OCRResult:
        # 這裡可換成 Tesseract / Paddle / Google
        text = self._run_ocr(image)
        return OCRResult(text=text, source="ocr_a")

    def _run_ocr(self, image: Image.Image) -> str:
        print("services/ocr/ocr_chi_eng.py ChiEngOCR._run_ocr()")
        print("text ocr-a:", pytesseract.image_to_string(
            image,
            lang='chi_tra+eng',
            config='--psm 6'
            ))
        return pytesseract.image_to_string(
            image,
            lang='chi_tra+eng',
            config='--psm 6'
            )
