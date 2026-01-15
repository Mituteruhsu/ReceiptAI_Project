# services/test_invoice_flow.py

from services.invoice_flow import process_invoice


def test_invoice_flow():
    print("=== Invoice Flow Test ===")

    image_path = "recive20220708.jpg"

    result = process_invoice(image_path)

    invoice = result["invoice"]
    classification = result["classification"]

    print("\n=== Invoice ===")
    print("Number:", invoice.number)
    print("Date:", invoice.date)
    print("Total:", invoice.total)

    print("\n=== Items ===")
    for item in invoice.items:
        print("-", item.name, item.qty, item.price)

    print("\n=== Classification ===")
    print("Main Category:", classification["main_category"].value)
    for item, cat in classification["items"]:
        print(f"- {item.name} → {cat.value}")


if __name__ == "__main__":
    test_invoice_flow()


# 單一測試檔案執行
# python -m services.test_invoice_flow

# 全域測試指令
# -s service 是尋找專案指定"services"資料夾下
# -p "test_*.py" 是尋找檔名符合 test_*.py 的測試檔案
# 執行 python -m unittest discover -s services -p "test_*.py"