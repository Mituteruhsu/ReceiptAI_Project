# client/forms.py
from django import forms
from domain.enums import Category, SubCategory, OwnerType
from domain.models import Item


class InvoiceConfirmForm(forms.Form):
    """發票確認表單"""
    
    number = forms.CharField(
        label='發票號碼',
        max_length=10,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'AA12345678'
        })
    )

    # 買方統編
    buyer_id = forms.CharField(
        label='買方統編',
        max_length=8,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '8 碼數字（選填）'
        })
    )

    # 賣方統編
    seller_id = forms.CharField(
        label='賣方統編',
        max_length=8,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '8 碼數字（選填）'
        })
    )
    
    date = forms.DateField(
        label='發票日期',
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    
    total = forms.DecimalField(
        label='總金額',
        max_digits=10,
        decimal_places=2,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'step': '0.01'
        })
    )
    
    category = forms.ChoiceField(
        label='主分類',
        choices=[(c.value, c.value) for c in Category],
        widget=forms.Select(attrs={
            'class': 'form-select',
            'id': 'id_category'
        })
    )

    subcategory = forms.ChoiceField(
        label='細分類',
        choices=[(s.value, s.label) for s in SubCategory],
        widget=forms.Select(attrs={
            'class': 'form-select',
            'id': 'id_subcategory'
        })
    )
    
    owner = forms.ChoiceField(
        label='使用者',
        choices=[(o.value, o.value) for o in OwnerType],
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    invoice_type = forms.CharField(
        widget=forms.HiddenInput()
    )


class ItemForm(forms.Form):
    """品項表單 (用於動態編輯)"""
    
    name = forms.CharField(
        label='品名',
        max_length=100,
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )
    
    quantity = forms.IntegerField(
        label='數量',
        min_value=1,
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    
    unit_price = forms.DecimalField(
        label='單價',
        max_digits=10,
        decimal_places=2,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'step': '0.01'
        })
    )
    
    category = forms.ChoiceField(
        label='分類',
        choices=[(c.value, c.value) for c in Category],
        required=False,
        widget=forms.Select(attrs={
            'class': 'form-select item-category',
            'onchange': 'updateSubCategories(this)'
        })
    )
    
    subcategory = forms.ChoiceField(
        label='細分類',
        choices=[('', '--- 請選擇 ---')] + SubCategory.get_choices(),
        required=False,
        widget=forms.Select(attrs={
            'class': 'form-select item-subcategory'
        })
    )