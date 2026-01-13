from enum import Enum

class InvoiceType(Enum):
    QR = "QR"
    PAPER = "Paper"

class Category(Enum):
    FOOD = "飲食"                   # 1
    CLOTHING = "衣物"               # 2
    MEDICAL = "醫藥/衛生"           # 3
    HOUSING = "住(租金/房貸)"       # 4
    HOUSHOLD_GOODS = "生活物品"      # 5
    TRANSPORT = "行(交通費/油錢)"    # 6
    EDUCATION = "教育(學費)"         # 7
    ENTERTAINMENT = "娛樂(場地門票)" # 8
    FINANCE = "理財"                # 9
    WINNING = "發票中獎"            # 10
    OTHER = "其它"                   # 11

# 小分類
class SubCategory(Enum):
    # 飲食
    VEGETABLE = ("菜錢", Category.FOOD)
    DRINK = ("飲料", Category.FOOD)
    RESTAURANT = ("餐廳", Category.FOOD)
    SNACK = ("零食", Category.FOOD)

    # 交通
    PARKING = ("停車費", Category.TRANSPORT)
    GASOLINE = ("油錢", Category.TRANSPORT)
    EASY_CARD = ("悠遊卡", Category.TRANSPORT)
    ETAG = ("eTag", Category.TRANSPORT)
    TAXI = ("計程車", Category.TRANSPORT)
    HSR = ("高鐵票", Category.TRANSPORT)
    TRA = ("台鐵票", Category.TRANSPORT)

    # 住
    WATER_ELECTRIC = ("水電", Category.HOUSING)
    GAS_FEE = ("瓦斯", Category.HOUSING)
    INTERNET = ("電視網路", Category.HOUSING)
    PHONE = ("手機/電話", Category.HOUSING)
    MORTGAGE = ("房貸", Category.HOUSING)
    MANAGEMENT = ("管理費", Category.HOUSING)

    # 生活
    SUNDRIES = ("雜貨", Category.HOUSHOLD_GOODS)
    APPLIANCE = ("電器品", Category.HOUSHOLD_GOODS)
    MAINTENANCE = ("維修保養", Category.HOUSHOLD_GOODS)
    

    # 娛樂
    MOVIE = ("電影票", Category.ENTERTAINMENT)
    TICKET = ("設施入場券", Category.ENTERTAINMENT)

    # 理財
    FUND = ("基金", Category.FINANCE)
    STOCK = ("股票", Category.FINANCE)
    GOLD = ("黃金", Category.FINANCE)
    EXCHANGE = ("換匯", Category.FINANCE)
    TAX = ("稅金", Category.FINANCE)
    FINE = ("罰款", Category.FINANCE)
    INSURANCE = ("保險", Category.FINANCE)

    # 其它
    DELIVERY_FAMILY = ("網購取件-全家", Category.OTHER)
    DELIVERY_711 = ("網購取件-7-11", Category.OTHER)
    DELIVERY_OK = ("網購取件-OK", Category.OTHER)
    DELIVERY_HILIFE = ("網購取件-萊爾富", Category.OTHER)

class OwnerType(Enum):
    ALL = "familyUse"
    FATHER = "father"
    MOTHER = "mother"
    CHILD_1 = "child_1"
    CHILD_2 = "child_2"
    CHILD_3 = "child_3"