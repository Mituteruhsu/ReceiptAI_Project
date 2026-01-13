from dataclasses import dataclass
from typing import Optional
from enums import Category, SubCategory

@dataclass
class Item:
    name: str
    qty: int = 1
    price: float = 0.0
    category: Optional[Category] = None
    sub_category: Optional[SubCategory] = None   # 新增這個欄位

    def total_price(self):
        return self.qty * self.price
