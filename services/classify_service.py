from domain.entities import Invoice
from domain.enums import Category, SubCategory

class InvoiceClassifier:
    @staticmethod
    def classify(invoice: Invoice):
        # Mock classification logic
        # In a real enterprise app, this might use a rules engine or a ML model
        for item in invoice.items:
            item.category = Category.FOOD
            item.sub_category = SubCategory.RESTAURANT
        return invoice
