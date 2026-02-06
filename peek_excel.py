import pandas as pd
import json

def peek_excel(file_path):
    try:
        df = pd.read_excel(file_path, header=None)
        first_rows = df.head(15).values.tolist()
        print(json.dumps(first_rows, indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    peek_excel("Offered Course Report.xlsx")
