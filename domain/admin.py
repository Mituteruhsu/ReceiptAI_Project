# domain/admin.py
from django.contrib import admin
from .models import Invoice, Item

class ItemInline(admin.TabularInline):
    model = Item
    extra = 0
    readonly_fields = ('created_at',)
    
@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'total', 'category', 'is_confirmed', 'is_synced')
    search_fields = ('number', 'buyer_id', 'seller_id')
    list_filter = ('category', 'invoice_type', 'is_confirmed', 'is_synced')
    readonly_fields = ('raw_qr_data', 'raw_ocr_data', 'created_at', 'updated_at')
    inlines = [ItemInline]  # 下面可以加 Item inline

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'name', 'quantity', 'unit_price', 'category', 'subcategory')
    search_fields = ('name', 'invoice__number')


