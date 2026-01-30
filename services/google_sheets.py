# services/google_sheets.py
import gspread
from google.oauth2.service_account import Credentials
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class GoogleSheetsService:
    """Google Sheets 儲存服務"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    
    def __init__(self):
        """初始化 Google Sheets 連線"""
        if not hasattr(settings, 'GOOGLE_SHEETS_CREDENTIALS'):
            logger.warning("未設定 Google Sheets 憑證，使用模擬模式")
            self.client = None
            return
        
        try:
            creds = Credentials.from_service_account_file(
                settings.GOOGLE_SHEETS_CREDENTIALS,
                scopes=self.SCOPES
            )
            self.client = gspread.authorize(creds)
        except Exception as e:
            logger.error(f"Google Sheets 連線失敗: {e}")
            self.client = None
    
    def save_invoice(self, invoice):
        """
        儲存發票到 Google Sheets
        
        Args:
            invoice: Invoice model instance
        """
        if not self.client:
            logger.info(f"[模擬] 儲存發票: {invoice.number} - NT${invoice.total}")
            return
        
        try:
            # 開啟試算表
            sheet = self.client.open(settings.GOOGLE_SHEETS_NAME).sheet1
            
            # 準備資料列
            row = [
                invoice.number,
                invoice.date.strftime('%Y-%m-%d'),
                float(invoice.total),
                invoice.category,
                invoice.owner,
                invoice.invoice_type,
                ', '.join([f"{item.name}x{item.quantity}" for item in invoice.items.all()])
            ]
            
            # 附加到試算表
            sheet.append_row(row)
            logger.info(f"成功儲存發票 {invoice.number} 至 Google Sheets")
            
        except Exception as e:
            logger.error(f"儲存至 Google Sheets 失敗: {e}")
            raise
    
    def get_all_invoices(self):
        """取得所有發票資料"""
        if not self.client:
            return []
        
        try:
            sheet = self.client.open(settings.GOOGLE_SHEETS_NAME).sheet1
            return sheet.get_all_records()
        except Exception as e:
            logger.error(f"讀取 Google Sheets 失敗: {e}")
            return []