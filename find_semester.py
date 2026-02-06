import pandas as pd
import re

def find_semester(file_path):
    try:
        # Read ALL rows, no header
        df = pd.read_excel(file_path, header=None)
        
        # Pattern for Semester (e.g., SPRING 2024-25, FALL 2023-24)
        pattern = re.compile(r'(SPRING|FALL|SUMMER|WINTER)\s+\d{4}-\d{2,4}', re.IGNORECASE)
        
        for r_idx, row in df.iterrows():
            for c_idx, value in enumerate(row):
                val_str = str(value).strip()
                if pattern.search(val_str):
                    print(f"FOUND: Row {r_idx}, Col {c_idx}, Value: {val_str}")
                    return val_str
        print("No semester pattern found.")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    find_semester("Offered Course Report.xlsx")
