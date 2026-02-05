import pandas as pd
import json
import re

def convert_excel_to_json(file_path, output_path):
    try:
        # Load the Excel file
        df = pd.read_excel(file_path)
        
        # Find the header row by searching for "Class ID"
        header_index = -1
        for i, row in df.iterrows():
            if "Class ID" in str(row.values):
                header_index = i
                break
        
        if header_index != -1:
            # Re-read with correct header
            df = pd.read_excel(file_path, skiprows=header_index + 1)
            # Map columns by index if names are messy
            # 1: Class ID, 2: Course Code, 3: Status, 4: Capacity, 5: Count, 6: Title, 7: Section, 9: Type, 10: Day, 11: Start, 12: End, 13: Room
            
        # Clean up column names based on common AIUB format
        # If the header detection failed, we fallback to indices
        cols = df.columns.tolist()
        
        # Map by common names or index
        def get_val(row, idx, fallback_name):
            if fallback_name in cols: return row[fallback_name]
            return row.iloc[idx]

        # Forward fill Course Code if it's merged
        # We need to find which column is Course Code. Usually index 2.
        # Let's just use the column containing "Code"
        code_col = [c for c in cols if "Code" in str(c)]
        if code_col:
            df[code_col[0]] = df[code_col[0]].ffill()

        courses_map = {}
        
        for _, row in df.iterrows():
            # Use columns by index based on the known AIUB report structure
            try:
                class_id = str(row.iloc[1])
                if not class_id or class_id == "nan" or class_id == "None": continue
                
                course_code = str(row.iloc[2])
                status = str(row.iloc[3])
                capacity = str(row.iloc[4])
                count = str(row.iloc[5])
                full_title = str(row.iloc[6])
                section_name = str(row.iloc[7])
                class_type = str(row.iloc[9])
                day = str(row.iloc[10])
                start_time = str(row.iloc[11])
                end_time = str(row.iloc[12])
                room = str(row.iloc[13])
                
                # Clean Title: "OBJECT ORIENTED PROGRAMMING [A]" -> "OBJECT ORIENTED PROGRAMMING"
                base_title = re.sub(r'\s*\[.*\]$', '', full_title).strip()
                
                # Unique Key: Group by Title + Code (handle nan code)
                clean_code = "" if course_code == "nan" else course_code
                key = f"{base_title}@@@{clean_code}"
                
                if key not in courses_map:
                    courses_map[key] = {
                        "code": clean_code,
                        "baseTitle": base_title,
                        "sections": {}
                    }
                
                if section_name not in courses_map[key]["sections"]:
                    courses_map[key]["sections"][section_name] = {
                        "id": class_id,
                        "section": section_name,
                        "status": status,
                        "capacity": capacity,
                        "count": count,
                        "schedules": []
                    }
                
                courses_map[key]["sections"][section_name]["schedules"].append({
                    "day": day,
                    "start": start_time,
                    "end": end_time,
                    "room": room,
                    "type": class_type
                })
            except:
                continue
                
        # Final formatting
        final_list = []
        for key, data in courses_map.items():
            section_list = list(data["sections"].values())
            # Sort sections naturally (A, B, C... or L1, L2...)
            section_list.sort(key=lambda x: x["section"])
            data["sections"] = section_list
            final_list.append(data)
            
        with open(output_path, 'w') as f:
            json.dump(final_list, f, indent=2)
            
        print(f"Successfully converted {len(final_list)} courses.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    convert_excel_to_json('Offered Course Report.xlsx', 'courses.json')
