// static/js/form-handler.js
class FormHandler {
    constructor() {
        this.form = document.getElementById('confirmForm');
        this.initializeForm();
    }
    
    initializeForm() {
        // 從 sessionStorage 載入資料
        const invoiceData = sessionStorage.getItem('invoiceData');
        if (!invoiceData) {
            alert('無發票資料');
            window.location.href = '/';
            return;
        }
        
        const data = JSON.parse(invoiceData);
        this.fillForm(data);
        this.renderItems(data.items || []);
    }
    
    fillForm(data) {
        // 自動填入表單
        document.getElementById('id_number').value = data.number || '';
        document.getElementById('id_buyer').value = data.buyer_id || '';
        document.getElementById('id_seller').value = data.seller_id || '';
        document.getElementById('id_date').value = data.date || '';
        document.getElementById('id_total').value = data.total || 0;
        document.getElementById('id_category').value = data.category || 'other';
        document.getElementById('id_subcategory').value = data.subcategory || '';
        document.getElementById('id_invoice_type').value = data.invoice_type || 'paper';
    }
    
    renderItems(items) {
        const container = document.getElementById('itemsList');
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<p class="text-muted">無品項資料</p>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'table table-sm';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>品名</th>
                    <th>數量</th>
                    <th>單價</th>
                    <th>分類</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.qty}</td>
                        <td>$${item.price}</td>
                        <td><span class="badge bg-secondary">${item.category || '未分類'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        container.appendChild(table);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('confirmForm')) {
        window.formHandler = new FormHandler();
    }
});