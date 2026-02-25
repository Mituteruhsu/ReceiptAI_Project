from services.recognition import OCRService, QRService
from services.invoice_parser import InvoiceParser
from services.classify_service import InvoiceClassifier

class InvoiceFlow:
    def __init__(self):
        self.ocr_service = OCRService()
        self.qr_service = QRService()
        self.parser = InvoiceParser()
        self.classifier = InvoiceClassifier()

    def process(self, image_data):
        # 1. Try QR first
        qr_data = self.qr_service.recognize(image_data)
        if qr_data:
            invoice = self.parser.parse_qr(qr_data)
        else:
            # 2. Try OCR
            ocr_text = self.ocr_service.recognize(image_data)
            invoice = self.parser.parse_ocr(ocr_text)

        # 3. Classify
        invoice = self.classifier.classify(invoice)

        return invoice
