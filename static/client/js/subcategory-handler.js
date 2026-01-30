// static/js/subcategory-handler.js

/**
 * 細分類動態更新處理器
 */
class SubCategoryHandler {
    constructor() {
        this.categorySelect = document.getElementById('id_category');
        this.itemCategorySelects = document.querySelectorAll('.item-category');
        
        this.init();
    }
    
    init() {
        // 主分類變更時，更新對應的細分類（如果有獨立的細分類欄位）
        if (this.categorySelect) {
            this.categorySelect.addEventListener('change', (e) => {
                this.updateMainSubCategories(e.target.value);
            });
        }
        
        // 品項分類變更時，更新細分類選項
        this.itemCategorySelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const subCategorySelect = this.findSubCategorySelect(select);
                if (subCategorySelect) {
                    this.updateSubCategoryOptions(e.target.value, subCategorySelect);
                }
            });
        });
    }
    
    /**
     * 找到對應的細分類選擇框
     */
    findSubCategorySelect(categorySelect) {
        const row = categorySelect.closest('tr') || categorySelect.closest('.item-row');
        if (row) {
            return row.querySelector('.item-subcategory');
        }
        return null;
    }
    
    /**
     * 更新主細分類（用於發票主分類）
     */
    async updateMainSubCategories(category) {
        console.log('主分類變更:', category);
        // 如果有獨立的發票細分類欄位，可在此更新
    }
    
    /**
     * 更新品項細分類選項
     */
    async updateSubCategoryOptions(category, subCategorySelect) {
        if (!category || !subCategorySelect) return;
        
        try {
            const response = await fetch(`/api/subcategories/?category=${category}`);
            const data = await response.json();
            
            // 清空現有選項
            subCategorySelect.innerHTML = '<option value="">--- 請選擇 ---</option>';
            
            // 加入新選項
            data.subcategories.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.value;
                option.textContent = sub.label;
                subCategorySelect.appendChild(option);
            });
            
            // 如果沒有細分類，顯示提示
            if (data.subcategories.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '此分類無細分類';
                option.disabled = true;
                subCategorySelect.appendChild(option);
            }
            
        } catch (error) {
            console.error('取得細分類失敗:', error);
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.subCategoryHandler = new SubCategoryHandler();
});


/**
 * 全域函數：更新細分類（供 inline onchange 使用）
 */
function updateSubCategories(selectElement) {
    const category = selectElement.value;
    const handler = window.subCategoryHandler;
    
    if (handler) {
        const subCategorySelect = handler.findSubCategorySelect(selectElement);
        if (subCategorySelect) {
            handler.updateSubCategoryOptions(category, subCategorySelect);
        }
    }
}