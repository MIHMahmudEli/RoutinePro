import pandas as pd

def inspect_excel(file_path):
    try:
        # Load the Excel file
        df = pd.read_excel(file_path)
        print("Columns found:")
        print(df.columns.tolist())
        print("\nFirst 5 rows:")
        print(df.head().to_json(orient='records', indent=2))
        
        # Save a small sample to JSON for testing
        df.head(100).to_json('sample_data.json', orient='records', indent=2)
        print("\nSample JSON saved to sample_data.json")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_excel('Offered Course Report.xlsx')
