import requests
import json

# Read text content
with open('last-page-extracted.txt', 'r', encoding='utf-8') as f:
    text_content = f.read()

# Create prompt
prompt = f"""Extract ALL products from this Amazon page. Return JSON array.
Each product should have: name, price, rating, reviews_count.

Content:
{text_content[1000:5000]}

Return complete JSON array with ALL products found:"""

# Call Ollama
response = requests.post('http://localhost:11434/api/generate', 
    json={
        "model": "qwen2.5-coder:3b-instruct",
        "prompt": prompt,
        "stream": False,
        "temperature": 0.1
    }
)

if response.status_code == 200:
    result = response.json()
    output = result['response']
    print("Response:")
    print(output)
    
    # Try to extract JSON
    try:
        json_start = output.find('[')
        json_end = output.rfind(']') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = output[json_start:json_end]
            products = json.loads(json_str)
            print(f"\nExtracted {len(products)} products")
            with open('ollama_products.json', 'w', encoding='utf-8') as f:
                json.dump(products, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"JSON parse error: {e}")
else:
    print(f"Error: {response.status_code}")
    print(response.text)