from abc import ABC, abstractmethod

class RecognitionService(ABC):
    @abstractmethod
    def recognize(self, image_data):
        pass

class OCRService(RecognitionService):
    def recognize(self, image_data):
        # Placeholder for actual OCR logic (e.g. DualOCR)
        # For now, return a mock string
        return "MOCK OCR TEXT: 2022-07-08 DF62269413 TOTAL 103"

class QRService(RecognitionService):
    def recognize(self, image_data):
        # Placeholder for actual QR logic
        return ["MOCK_QR_DATA_1", "MOCK_QR_DATA_2"]
