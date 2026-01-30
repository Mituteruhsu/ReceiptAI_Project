# domain/enums.py
from enum import Enum

class InvoiceType(Enum):
    """發票類型"""
    QR = "qr"
    PAPER = "paper"

class Category(Enum):
    """主分類"""
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
    """細分類 (value, label, parent_category)"""
    # 飲食
    VEGETABLE = ("vegetable", "菜錢", Category.FOOD)
    DRINK = ("drink", "飲料", Category.FOOD)
    RESTAURANT = ("restaurant", "餐廳", Category.FOOD)
    SNACK = ("snack", "零食", Category.FOOD)
    
    # 交通
    PARKING = ("parking", "停車費", Category.TRANSPORT)
    GASOLINE = ("gasoline", "油錢", Category.TRANSPORT)
    EASY_CARD = ("easy_card", "悠遊卡", Category.TRANSPORT)
    ETAG = ("etag", "eTag", Category.TRANSPORT)
    TAXI = ("taxi", "計程車", Category.TRANSPORT)
    HSR = ("hsr", "高鐵票", Category.TRANSPORT)
    TRA = ("tra", "台鐵票", Category.TRANSPORT)
    
    # 住
    WATER_ELECTRIC = ("water_electric", "水電", Category.HOUSING)
    GAS_FEE = ("gas_fee", "瓦斯", Category.HOUSING)
    INTERNET = ("internet", "電視網路", Category.HOUSING)
    PHONE = ("phone", "手機/電話", Category.HOUSING)
    MORTGAGE = ("mortgage", "房貸", Category.HOUSING)
    MANAGEMENT = ("management", "管理費", Category.HOUSING)
    
    # 生活
    SUNDRIES = ("sundries", "雜貨", Category.HOUSEHOLD_GOODS)
    TISSUE = ("tissue", "衛生紙", Category.HOUSEHOLD_GOODS)
    APPLIANCE = ("appliance", "電器品", Category.HOUSEHOLD_GOODS)
    MAINTENANCE = ("maintenance", "維修保養", Category.HOUSEHOLD_GOODS)
    
    # 娛樂
    MOVIE = ("movie", "電影票", Category.ENTERTAINMENT)
    TICKET = ("ticket", "設施入場券", Category.ENTERTAINMENT)
    
    # 理財
    FUND = ("fund", "基金", Category.FINANCE)
    STOCK = ("stock", "股票", Category.FINANCE)
    GOLD = ("gold", "黃金", Category.FINANCE)
    EXCHANGE = ("exchange", "換匯", Category.FINANCE)
    TAX = ("tax", "稅金", Category.FINANCE)
    FINE = ("fine", "罰款", Category.FINANCE)
    INSURANCE = ("insurance", "保險", Category.FINANCE)
    
    # 其他
    DELIVERY_FAMILY = ("delivery_family", "網購取件-全家", Category.OTHER)
    DELIVERY_711 = ("delivery_711", "網購取件-7-11", Category.OTHER)
    DELIVERY_OK = ("delivery_ok", "網購取件-OK", Category.OTHER)
    DELIVERY_HILIFE = ("delivery_hilife", "網購取件-萊爾富", Category.OTHER)
    
    def __init__(self, value, label, parent):
        self._value_ = value
        self._label = label
        self._parent = parent
    
    @property
    def label(self):
        """顯示標籤"""
        return self._label
    
    @property
    def parent(self):
        """父分類"""
        return self._parent
    
    @classmethod
    def get_choices(cls):
        """取得所有選項 (value, label)"""
        return [(item.value, item.label) for item in cls]
    
    @classmethod
    def get_choices_by_parent(cls, parent_category: Category):
        """根據父分類取得選項"""
        return [
            (item.value, item.label) 
            for item in cls 
            if item.parent == parent_category
        ]
    
    @classmethod
    def from_value(cls, value):
        """從 value 取得 SubCategory"""
        for item in cls:
            if item.value == value:
                return item
        return None

class OwnerType(Enum):
    """使用者"""
    ALL = "familyUse"
    FATHER = "father"
    MOTHER = "mother"
    CHILD_1 = "child_1"
    CHILD_2 = "child_2"