# services/classify_service.py
from typing import Dict, List
from domain.enums import Category, SubCategory


class InvoiceClassifier:
    """發票分類器"""
    
    # 分類關鍵字規則
    KEYWORDS = {
        Category.FOOD: ['蛋', '飯', '麵', '肉', '飲', '可樂', '咖啡', '茶', '餐', '食'],
        Category.HOUSEHOLD_GOODS: ['衛生紙', '清潔', '洗', '杯', '袋', '紙巾'],
        Category.MEDICAL: ['藥', '口罩', '酒精', '維他命'],
        Category.TRANSPORT: ['汽油', '停車', '車', '加油', 'etag'],
        Category.ENTERTAINMENT: ['電影', '門票', '遊樂'],
    }

    SUBCATEGORY_KEYWORDS = {
        SubCategory.VEGETABLE: ['菜', '青菜', '蔬菜'],
        SubCategory.DRINK: ['飲料', '可樂', '咖啡', '茶'],
        SubCategory.RESTAURANT: ['餐', '便當', '牛排', '火鍋'],
        SubCategory.SNACK: ['零食', '餅乾'],

        SubCategory.GASOLINE: ['汽油', '加油'],
        SubCategory.PARKING: ['停車'],
        SubCategory.ETAG: ['etag'],
        SubCategory.TAXI: ['計程車'],
        SubCategory.HSR: ['高鐵'],
        SubCategory.TRA: ['台鐵'],

        SubCategory.WATER_ELECTRIC: ['水電'],
        SubCategory.GAS_FEE: ['瓦斯'],
        SubCategory.INTERNET: ['網路', '電視'],
        SubCategory.PHONE: ['手機', '電信'],

        SubCategory.MOVIE: ['電影'],
        SubCategory.TICKET: ['門票'],
    }
    
    @staticmethod
    def classify(parsed_data: Dict) -> Dict:
        """
        分類發票及品項
        
        Args:
            parsed_data: 解析後的發票資料
            
        Returns:
            {
                'main_category': 'food',
                'items': [
                    {'name': '...', 'qty': 1, 'price': 65, 'category': 'food'},
                    ...
                ]
            }
        """
        print("services/classify_service.py InvoiceClassifier.classify() - start")
        items = parsed_data.get('items', [])
        category_count = {}
        subcat_count = {}
        classified_items = []
        # print(f"Items to classify: {items}")
        # 分類每個品項
        for item in items:
            subcat, category = InvoiceClassifier._classify_item(item['name'])

            item['category'] = category.value
            item['subcategory'] = subcat.label if subcat else None

            classified_items.append(item)
            
            category_count[category] = category_count.get(category, 0) + 1
            subcat_count[subcat] = subcat_count.get(subcat, 0) + 1
        
        main_subcategory = max(subcat_count, key=subcat_count.get) if subcat_count else None
        # 主分類：品項數最多的分類
        if category_count:
            main_category = max(category_count, key=category_count.get)
        else:
            main_category = Category.OTHER
        
        # print(f"主分類: {main_category.value}, 分類後品項: {classified_items}")
        print("services/classify_service.py InvoiceClassifier.classify() - end")
        return {
            'main_category': main_category.value,
            'main_subcategory': main_subcategory.value,
            'items': classified_items
        }
    
    @staticmethod
    def _classify_item(item_name: str) -> Category:
        """根據品名分類"""
        print(f"services/classify_service.py InvoiceClassifier._classify_item() - \n\tClassifying item: {item_name}")
        for subcat, keywords in InvoiceClassifier.SUBCATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in item_name:
                    return subcat, subcat.parent
            
        for category, keywords in InvoiceClassifier.KEYWORDS.items():
            for keyword in keywords:
                if keyword in item_name:
                    return category
                
        return  None, Category.OTHER