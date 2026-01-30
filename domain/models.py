# domain/models.py
from django.db import models
from django.core.validators import MinValueValidator
from .enums import InvoiceType, Category, SubCategory, OwnerType


class Invoice(models.Model):
    """發票主表"""
    number = models.CharField('發票號碼', max_length=10, unique=True)
    date = models.DateField('發票日期')
    total = models.DecimalField('總金額', max_digits=10, decimal_places=2, 
                                validators=[MinValueValidator(0)])
    invoice_type = models.CharField('發票類型', max_length=10, 
                                   choices=[(t.value, t.name) for t in InvoiceType],
                                   default=InvoiceType.PAPER.value)
    category = models.CharField('主分類', max_length=20,
                               choices=[(c.value, c.name) for c in Category],
                               default=Category.OTHER.value)
    owner = models.CharField('使用者', max_length=20,
                            choices=[(o.value, o.name) for o in OwnerType],
                            default=OwnerType.ALL.value)
    
    # 原始資料
    raw_qr_data = models.JSONField('QR原始資料', null=True, blank=True)
    raw_ocr_data = models.TextField('OCR原始資料', null=True, blank=True)
    image = models.ImageField('發票圖片', upload_to='invoices/%Y/%m/', null=True, blank=True)
    
    # 狀態追蹤
    is_confirmed = models.BooleanField('已確認', default=False)
    is_synced = models.BooleanField('已同步至 Sheets', default=False)
    
    created_at = models.DateTimeField('建立時間', auto_now_add=True)
    updated_at = models.DateTimeField('更新時間', auto_now=True)
    
    class Meta:
        db_table = 'invoices'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['number']),
            models.Index(fields=['date']),
            models.Index(fields=['is_confirmed']),
        ]
    
    def __str__(self):
        return f"{self.number} - {self.date} - NT${self.total}"
    
    @property
    def items_total(self):
        """從品項計算總額"""
        return sum(item.subtotal for item in self.items.all())


class Item(models.Model):
    """發票品項"""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, 
                               related_name='items', verbose_name='發票')
    name = models.CharField('品名', max_length=100)
    quantity = models.PositiveIntegerField('數量', default=1)
    unit_price = models.DecimalField('單價', max_digits=10, decimal_places=2,
                                     validators=[MinValueValidator(0)])
    
    category = models.CharField('品項分類', max_length=20,
                               choices=[(c.value, c.value) for c in Category],
                               null=True, blank=True)
    sub_category = models.CharField('細分類', max_length=30,
                                   choices=SubCategory.get_choices(),
                                   null=True, blank=True)
    
    order = models.PositiveSmallIntegerField('排序', default=0)
    
    created_at = models.DateTimeField('建立時間', auto_now_add=True)
    
    class Meta:
        db_table = 'items'
        ordering = ['order', 'id']
        indexes = [
            models.Index(fields=['invoice', 'order']),
        ]
    
    def __str__(self):
        return f"{self.name} x{self.quantity}"
    
    @property
    def subtotal(self):
        """小計"""
        return self.quantity * self.unit_price