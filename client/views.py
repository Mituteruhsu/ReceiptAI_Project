# client/views.py (新增 API 端點)
from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.contrib import messages
from domain.models import Invoice, Item
from .forms import InvoiceConfirmForm
from services.google_sheets import GoogleSheetsService


class UploadView(TemplateView):
    """上傳與拍照頁面"""
    template_name = 'client/upload.html'


class ConfirmView(TemplateView):
    """分類確認頁面"""
    template_name = 'client/confirm.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 從 session 取得辨識結果
        invoice_data = self.request.session.get('invoice_data')
        
        if invoice_data:
            form = InvoiceConfirmForm(initial=invoice_data)
            context['form'] = form
            context['items'] = invoice_data.get('items', [])
        
        return context
    
    def post(self, request, *args, **kwargs):
        """處理確認送出"""
        form = InvoiceConfirmForm(request.POST)
        
        if form.is_valid():
            # 儲存到資料庫
            invoice = Invoice.objects.create(
                number=form.cleaned_data['number'],
                date=form.cleaned_data['date'],
                total=form.cleaned_data['total'],
                category=form.cleaned_data['category'],
                owner=form.cleaned_data['owner'],
                invoice_type=form.cleaned_data['invoice_type'],
                raw_qr_data=request.session.get('raw_qr_data'),
                raw_ocr_data=request.session.get('raw_ocr_data'),
            )
            
            # 儲存品項
            items_data = request.session.get('invoice_data', {}).get('items', [])
            for idx, item_data in enumerate(items_data):
                Item.objects.create(
                    invoice=invoice,
                    name=item_data['name'],
                    quantity=item_data['qty'],
                    unit_price=item_data['price'],
                    category=item_data.get('category'),
                    order=idx
                )
            
            # 同步到 Google Sheets
            try:
                sheets_service = GoogleSheetsService()
                sheets_service.save_invoice(invoice)
                invoice.is_synced = True
                invoice.save()
                messages.success(request, '發票已成功儲存並同步至 Google Sheets')
            except Exception as e:
                messages.warning(request, f'發票已儲存，但同步 Google Sheets 失敗: {e}')
            
            # 清除 session
            request.session.pop('invoice_data', None)
            request.session.pop('raw_qr_data', None)
            request.session.pop('raw_ocr_data', None)
            
            return redirect('client:success')
        
        return render(request, self.template_name, {'form': form})


class SuccessView(TemplateView):
    """成功頁面"""
    template_name = 'client/success.html'
