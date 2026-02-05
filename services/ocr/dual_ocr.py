# services/ocr/dual_ocr.py
from services.ocr.ocr_chi_eng import ChiEngOCR
from services.ocr.ocr_eng_digits import EngDigitsOCR

class DualOCRService:
    """
    Dual OCR Strategy
    OCR-A: chi_tra + eng
    OCR-B: eng + digits
    """

    def __init__(self):
        self.ocr_a = ChiEngOCR()
        self.ocr_b = EngDigitsOCR()

    def extract(self, image) -> dict:
        """
        回傳結構化結果，保留來源
        """
        print("services/ocr/dual_ocr.py DualOCRService.extract() - start")
        result_a = self.ocr_a.extract(image)
        result_b = self.ocr_b.extract(image)
        print("services/ocr/dual_ocr.py DualOCRService.extract() - \n\tOCR-A result:", result_a)
        print("services/ocr/dual_ocr.py DualOCRService.extract() - \n\tOCR-B result:", result_b)
        print("services/ocr/dual_ocr.py DualOCRService.extract() - end")
        return {
            "ocr_a": {
                "purpose": "store_name / items",
                "text": result_a.text
            },
            "ocr_b": {
                "purpose": "amount / date / invoice_number",
                "text": result_b.text
            }
        }
