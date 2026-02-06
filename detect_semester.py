import openpyxl

def detect_semester(file_path):
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        
        # Check first 5 rows for any string containing a typical semester pattern
        keywords = ["SPRING", "FALL", "SUMMER", "WINTER", "2024", "2025"]
        
        for row in sheet.iter_rows(max_row=50):
            for cell in row:
                if cell.value:
                    val = str(cell.value).upper()
                    if any(kw in val for kw in keywords):
                        print(f"BINGO: {cell.value}")
                        return cell.value
        print("NOT_FOUND")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    detect_semester("Offered Course Report.xlsx")
