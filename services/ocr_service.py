# services/ocr_service.py
import easyocr
from PIL import Image
import numpy as np
from typing import Dict


class OCRService:
    """OCR 文字辨識服務"""
    
    def __init__(self):
        self.reader = easyocr.Reader(['ch_tra'], gpu=False)
    
    def extract_text(self, image: Image.Image) -> Dict[str, str]:
        """
        提取影像中的文字
        
        Returns:
            {'raw_text': 'extracted text'}
        """
        # 轉為 numpy array
        img_array = np.array(image)
        
        # OCR 辨識
        result = self.reader.readtext(img_array, detail=0)
        raw_text = '\n'.join(result)
        
        return {'raw_text': raw_text}
