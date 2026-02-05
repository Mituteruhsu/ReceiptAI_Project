# services/ocr_service.py
import easyocr
from PIL import Image
import numpy as np
from typing import Dict
from services.ocr.dual_ocr import DualOCRService
from services.invoice_parser import InvoiceParser

class OCRService:
    """OCR 文字辨識服務"""
    
    def __init__(self): 
        self.reader = easyocr.Reader(['ch_tra'], gpu=False)
        self.dual_ocr = DualOCRService()

    def extract_text(self, image: Image.Image) -> Dict[str, str]:
        """
        提取影像中的文字
        
        Returns:
            {'raw_text': 'extracted text'}
        """
        print("services/ocr_service.py OCRService.extract_text() - start")
        # 轉為 numpy array
        img_array = np.array(image)
        # print("services/ocr_service.py OCRService.extract_text() - \n\timage converted to numpy array", img_array)
        
        # OCR 辨識
        # result = self.reader.readtext(img_array, detail=0)
        # print("services/ocr_service.py OCRService.extract_text() - \n\tOCR result:", result)
        # raw_text = '\n'.join(result)
        # print("services/ocr_service.py OCRService.extract_text() - \n\textracted raw_text:", raw_text)
        
        ocr_result = self.dual_ocr.extract(image)

        parsed_invoice = InvoiceParser().parse_ocr(
            text_items=ocr_result["ocr_a"]["text"],
            text_meta=ocr_result["ocr_b"]["text"]
        )
        print("services/ocr_service.py OCRService.extract_text() - \n\tparsed_invoice:", parsed_invoice)

        # return {'raw_text': raw_text}
