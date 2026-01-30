# services/classify_service.py
from typing import Dict, List
from domain.enums import Category


class InvoiceClassifier:
    """發票分類器"""
    
    # 分類關鍵字規則
    KEYWORDS = {
        Category.FOOD: ['蛋', '飯', '麵', '肉', '飲', '可樂', '咖啡', '茶', '餐', '食'],
        Category.HOUSEHOLD_GOODS: ['衛生紙', '清潔', '洗', '杯', '袋', '紙巾'],
        Category.MEDICAL: ['藥', '口罩', '酒精', '維他命'],
        Category.TRANSPORT: ['油', '停車', '車', '加油', 'etag'],
        Category.ENTERTAINMENT: ['電影', '門票', '遊樂'],
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
        items = parsed_data.get('items', [])
        category_count = {}
        classified_items = []
        
        # 分類每個品項
        for item in items:
            category = InvoiceClassifier._classify_item(item['name'])
            item['category'] = category.value
            classified_items.append(item)
            
            category_count[category] = category_count.get(category, 0) + 1
        
        # 主分類：品項數最多的分類
        if category_count:
            main_category = max(category_count, key=category_count.get)
        else:
            main_category = Category.OTHER
        
        return {
            'main_category': main_category.value,
            'items': classified_items
        }
    
    @staticmethod
    def _classify_item(item_name: str) -> Category:
        """根據品名分類"""
        for category, keywords in InvoiceClassifier.KEYWORDS.items():
            for keyword in keywords:
                if keyword in item_name:
                    return category
        return Category.OTHER