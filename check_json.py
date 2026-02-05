import json

def verify_data():
    with open('courses.json', 'r') as f:
        data = json.load(f)
    
    # Check sections for a few courses
    for course in data[:10]:
        print(f"Course: {course['baseTitle']} ({course['code']})")
        print(f"  Sections: {[s['section'] for s in course['sections']]}")
        print("-" * 20)

if __name__ == "__main__":
    verify_data()
