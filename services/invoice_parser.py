# services/invoice_parser.py
from datetime import datetime
from typing import Dict, List, Tuple
import re
from domain.enums import InvoiceType


class InvoiceParser:
    """發票解析器"""
    
    @staticmethod
    def parse_qr(qr_strings: List[str]) -> Dict:
        """
        解析台灣電子發票 QR Code
        
        Returns:
            {
                'number': 'DF62269413',
                'date': '2022-07-08',
                'total': 103,
                'items': [{'name': '...', 'qty': 1, 'price': 65}],
                'invoice_type': 'qr'
            }
        """
        print("services/invoice_parser.py InvoiceParser.parse_qr() - start")
        if not qr_strings:
            raise ValueError("QR 資料為空")

        header_qr = None
        items_qr = None

        for qr in qr_strings:
            if ':' in qr:
                items_qr = qr
            else:
                header_qr = qr

        if not header_qr:
            raise ValueError("找不到發票 Header QR")

        # print(f"services/invoice_parser.py InvoiceParser.parse_qr() - \n\theader_qr: {header_qr}")
        # print(f"services/invoice_parser.py InvoiceParser.parse_qr() - \n\titems_qr: {items_qr}")
        # ===== Header QR（固定 77 碼）=====
        invoice_number = items_qr[0:10]
        roc_date = items_qr[10:17]
        date = InvoiceParser._roc_to_ad_date(roc_date)
        
        total_hex = items_qr[29:37]
        # 十六進位轉十進位
        total_amount = int(total_hex, 16)
        
        buyer_id = items_qr[37:45]
        buyer_id = None if buyer_id == "00000000" else buyer_id
        seller_id = items_qr[45:53]
        
        print(f"services/invoice_parser.py InvoiceParser.parse_qr()\n\tinvoice_number: {invoice_number}\n\tdate: {date}\n\ttotal_amount: {total_amount}\n\tbuyer_id: {buyer_id}\n\tseller_id: {seller_id}")
        # ===== Items =====
        items = []
        if items_qr:
            items = InvoiceParser._parse_items_qr(items_qr)
        # print(f"invoice_number: {invoice_number}\n, date: {date}\n, total: {total_amount}\n, buyer_id: {buyer_id}\n, seller_id: {seller_id}\n, items: {items}")
        # print(f"invoice_type: {InvoiceType.QR.value}")
        print("services/invoice_parser.py InvoiceParser.parse_qr() - end")
        return {
            'number': invoice_number,
            'date': date,
            'total': total_amount,
            'buyer_id': buyer_id,
            'seller_id': seller_id,
            'items': items,
            'invoice_type': InvoiceType.QR.value
        }
    
    @staticmethod
    def parse_ocr(text: str) -> Dict:
        """
        解析 OCR 文字
        
        Returns:
            {
                'number': 'BB87654321',
                'date': '2022-07-08',
                'total': 800,
                'items': [],
                'invoice_type': 'paper'
            }
        """
        result = {
            'number': '',
            'date': '',
            'total': 0,
            'items': [],
            'invoice_type': InvoiceType.PAPER.value
        }
        
        # 提取發票號碼 (10 碼英數字)
        number_match = re.search(r'[A-Z]{2}\d{8}', text)
        if number_match:
            result['number'] = number_match.group()
        
        # 提取日期
        date_patterns = [
            r'(\d{3})[年/\-](\d{1,2})[月/\-](\d{1,2})',  # 民國年
            r'(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})',  # 西元年
        ]
        for pattern in date_patterns:
            date_match = re.search(pattern, text)
            if date_match:
                year, month, day = date_match.groups()
                year = int(year)
                if year < 1000:  # 民國年
                    year += 1911
                result['date'] = f"{year}-{int(month):02d}-{int(day):02d}"
                break
        
        # 提取總金額
        total_patterns = [
            r'總計[：:]\s*\$?\s*(\d+)',
            r'合計[：:]\s*\$?\s*(\d+)',
            r'總額[：:]\s*\$?\s*(\d+)',
        ]
        for pattern in total_patterns:
            total_match = re.search(pattern, text)
            if total_match:
                result['total'] = int(total_match.group(1))
                break
        
        return result
    
    @staticmethod
    def _roc_to_ad_date(roc: str) -> str:
        """民國日期轉西元 1110708 → 2022-07-08"""
        print("services/invoice_parser.py InvoiceParser._roc_to_ad_date() - start")
        year = int(roc[:3]) + 1911
        month = int(roc[3:5])
        day = int(roc[5:7])
        print(f"services/invoice_parser.py InvoiceParser._roc_to_ad_date() - \n\tyear: {year}\n\tmonth: {month}\n\tday: {day}")
        print(f"services/invoice_parser.py InvoiceParser._roc_to_ad_date() - end")
        return f"{year:04d}-{month:02d}-{day:02d}"
    
    @staticmethod
    def _parse_items_qr(items_qr: str) -> List[Dict]:
        """
        解析 Items QR
        格式: :序號:數量:金額:品名:數量:金額:品名...
        """
        print("services/invoice_parser.py _parse_items_qr() - start")
        parts = items_qr.split(':')
        # print(f"services/invoice_parser.py _parse_items_qr() - \n\tParsing items from QR parts: {parts}")

        # parts[5] 開始才是品目
        items = []
        for i in range(5, len(parts), 3):
            try:
                name = parts[i]
                qty = float(parts[i + 1])
                price = float(parts[i + 2])
                items.append({
                    'name': name,
                    'qty': qty,
                    'price': price
                })
            except (IndexError, ValueError):
                continue
        print(f"services/invoice_parser.py _parse_items_qr() - \n\tparsed items: {items}")
        print("services/invoice_parser.py _parse_items_qr() - end")
        return items