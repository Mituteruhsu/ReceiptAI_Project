# services/ocr/base.py
from abc import ABC, abstractmethod

class OCRResult:
    def __init__(self, text: str, source: str):
        self.text = text
        self.source = source  # ocr_a / ocr_b

class BaseOCR(ABC):
    @abstractmethod
    def extract(self, image) -> OCRResult:
        pass
