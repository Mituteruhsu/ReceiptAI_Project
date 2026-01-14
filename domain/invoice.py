from dataclasses import dataclass, field
from typing import List
from .enums import InvoiceType
from .item import Item

@dataclass
class Invoice:
    number: str
    date: str
    total: float = 0
    items: List[Item] = field(default_factory=list)
    invoice_type: InvoiceType = InvoiceType.PAPER

    # <-- 加上這個方法
    def add_item(self, item: Item):
        self.items.append(item)
        self.total += item.qty * item.price
