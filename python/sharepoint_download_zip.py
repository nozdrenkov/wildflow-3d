import requests
import json
import urllib.parse
import concurrent.futures
import os
from tqdm import tqdm  # Import tqdm for progress bar

def download_files(batch, batch_number):
    url = 'https://ukwest1-mediap.svc.ms/transform/zip?cs=fFNQTw'
    
    headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-GB,en;q=0.9,fr;q=0.8',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://livelancsac.sharepoint.com',
        'priority': 'u=0, i',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'iframe',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    }
    
    # Build the files data structure using the exact format from the original request
    files_data = {
        "items": [
            {
                "name": filename,
                "size": original_files_dict[filename]['size'],
                "docId": f"https://livelancsac.sharepoint.com:443/_api/v2.0/drives/b!z_EINbNYeUKIJO6z5-G_U9PwBhfZWuJDrn-Gek2u9FQsp2Nb0de-SK0c8mdAeodN/items/{original_files_dict[filename]['id']}?version=Published&access_token=v1.eyJzaXRlaWQiOiIzNTA4ZjFjZi01OGIzLTQyNzktODgyNC1lZWIzZTdlMWJmNTMiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvbGl2ZWxhbmNzYWMuc2hhcmVwb2ludC5jb21AOWM5YmNkMTEtOTc3YS00ZTljLWE5YTAtYmM3MzQwOTAxNjRhIiwiZXhwIjoiMTczNTUxNjgwMCJ9.CiMKCXNoYXJpbmdpZBIWTDEzS0ZmcEo1VUNVYkprNDhBTFplQQoICgNzdHASAXQKCgoEc25pZBICMzMSBgjE7DoQARoPMTg3LjE5MC4xNzUuMjQwIhRtaWNyb3NvZnQuc2hhcmVwb2ludCosTnBlbG13U3h5anpIMHExQk1jU3VoOVk5WlNHRVdVWlZhVWxseFpJK09qND0wdjgBShBoYXNoZWRwcm9vZnRva2VuYgR0cnVlcjYwaC5mfG1lbWJlcnNoaXB8dXJuJTNhc3BvJTNhZ3Vlc3Qjbm96ZHJlbmtvdkBnbWFpbC5jb216ATDCATYwIy5mfG1lbWJlcnNoaXB8dXJuJTNhc3BvJTNhZ3Vlc3Qjbm96ZHJlbmtvdkBnbWFpbC5jb20.ySNnZbB0Y66V6Jw4mErwYnsqNKlWjY5iNtv7l402z3k",
                "isFolder": False
            }
            for filename in batch
        ]
    }
    
    data = {
        'zipFileName': f'OneDrive_batch_{batch_number}.zip',
        'guid': 'bcadd33b-7af1-49af-96d2-68bb73f899c4',  # Updated from curl command
        'provider': 'spo',
        'files': json.dumps(files_data),
        'oAuthToken': ''
    }
    
    # Make the request and save the file
    print("downloading batch " + str(batch_number))
    response = requests.post(url, headers=headers, data=data)
    
    if response.status_code == 200:
        with open(f'OneDrive_batch_{batch_number}.zip', 'wb') as f:
            f.write(response.content)
        print(f"Successfully downloaded batch {batch_number} to OneDrive_batch_{batch_number}.zip")
    else:
        print(f"Error downloading batch {batch_number}: {response.status_code}")
        print(response.text)

# Load the file data from the JSON file
with open('files_2023.json', 'r') as json_file:
    original_files = json.load(json_file)

# Convert the loaded data into the required format
original_files_dict = {file['filename']: {'size': int(file['file_size']), 'id': file['file_id']} for file in original_files}

# Prepare the list of all files to download
files_to_download = list(original_files_dict.keys())

# Split files into batches of 100
batches = [files_to_download[i:i + 100] for i in range(0, len(files_to_download), 100)]

# Print the total number of batches
total_batches = len(batches)
print(f"Total batches to download: {total_batches}")

# Download batches in parallel with progress bar
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(download_files, batch, i + 1): i + 1 for i, batch in enumerate(batches)}
    # start_from = 1
    # futures = {executor.submit(download_files, batch, i + 1): i + 1 for i, batch in enumerate(batches[start_from - 1:], start=start_from - 1)}
    for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Downloading batches"):
        batch_number = futures[future]
        try:
            future.result()
        except Exception as e:
            print(f"Batch {batch_number} generated an exception: {e}")