from enum import Enum

class InvoiceType(Enum):
    QR = "qr"
    PAPER = "paper"

class Category(Enum):
    FOOD = "飲食"
    CLOTHING = "衣物"
    MEDICAL = "醫藥/衛生"
    HOUSING = "住(租金/房貸)"
    HOUSEHOLD_GOODS = "生活物品"
    TRANSPORT = "行(交通費/油錢)"
    EDUCATION = "教育(學費)"
    ENTERTAINMENT = "娛樂(場地門票)"
    FINANCE = "理財"
    WINNING = "發票中獎"
    OTHER = "其它"

class SubCategory(Enum):
    # (value, label, parent_category)
    VEGETABLE = ("vegetable", "菜錢", Category.FOOD)
    DRINK = ("drink", "飲料", Category.FOOD)
    RESTAURANT = ("restaurant", "餐廳", Category.FOOD)
    SNACK = ("snack", "零食", Category.FOOD)
    
    PARKING = ("parking", "停車費", Category.TRANSPORT)
    GASOLINE = ("gasoline", "油錢", Category.TRANSPORT)
    
    WATER_ELECTRIC = ("water_electric", "水電", Category.HOUSING)
    PHONE = ("phone", "手機/電話", Category.HOUSING)
    
    SUNDRIES = ("sundries", "雜貨", Category.HOUSEHOLD_GOODS)
    TISSUE = ("tissue", "衛生紙", Category.HOUSEHOLD_GOODS)
    
    MOVIE = ("movie", "電影票", Category.ENTERTAINMENT)
    
    FUND = ("fund", "基金", Category.FINANCE)
    TAX = ("tax", "稅金", Category.FINANCE)
    
    DELIVERY_711 = ("delivery_711", "網購取件-7-11", Category.OTHER)

    def __init__(self, value, label, parent):
        self._value_ = value
        self._label = label
        self._parent = parent

    @property
    def label(self): return self._label

    @property
    def parent(self): return self._parent

    @classmethod
    def from_value(cls, value):
        for item in cls:
            if item.value == value: return item
        return None
