from dataclasses import dataclass, field
from typing import List, Optional
from .enums import InvoiceType, Category, SubCategory

@dataclass
class Item:
    name: str
    qty: int = 1
    price: float = 0.0
    category: Optional[Category] = None
    sub_category: Optional[SubCategory] = None

    @property
    def total_price(self):
        return self.qty * self.price

@dataclass
class Invoice:
    number: str
    date: str
    total: float = 0
    items: List[Item] = field(default_factory=list)
    invoice_type: InvoiceType = InvoiceType.PAPER

    def add_item(self, item: Item):
        self.items.append(item)
        # We don't necessarily update total here if it was already parsed
        # But for new invoices, it might be useful
        if self.total == 0:
            self.total = sum(i.total_price for i in self.items)

    def to_dict(self):
        return {
            "number": self.number,
            "date": self.date,
            "total": self.total,
            "invoice_type": self.invoice_type.value,
            "items": [
                {
                    "name": i.name,
                    "qty": i.qty,
                    "price": i.price,
                    "category": i.category.value if i.category else None,
                    "subcategory": i.sub_category.value if i.sub_category else None
                }
                for i in self.items
            ]
        }
