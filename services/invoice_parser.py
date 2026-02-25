from domain.entities import Invoice, Item
from domain.enums import InvoiceType

class InvoiceParser:
    @staticmethod
    def parse_qr(raw_qrs):
        # Mock parsing logic
        return Invoice(
            number="QR-12345678",
            date="2022-07-08",
            total=100.0,
            invoice_type=InvoiceType.QR
        )

    @staticmethod
    def parse_ocr(raw_text):
        # Mock parsing logic
        return Invoice(
            number="DF-62269413",
            date="2022-07-08",
            total=103.0,
            invoice_type=InvoiceType.PAPER
        )
