import requests
import json
import urllib.parse

def download_files(output_filename):
    url = 'https://ukwest1-mediap.svc.ms/transform/zip'
    
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
    
    # Load the file data from the JSON file
    with open('files_2024.json', 'r') as json_file:
        original_files = json.load(json_file)

    # Convert the loaded data into the required format
    original_files_dict = {file['filename']: {'size': int(file['file_size']), 'id': file['file_id']} for file in original_files}
    
    # Build the files data structure using the exact format from the original request
    files_data = {
        "items": [
            {
                "name": filename,
                "size": original_files_dict[filename]['size'],
                "docId": f"https://livelancsac.sharepoint.com:443/_api/v2.0/drives/b!z_EINbNYeUKIJO6z5-G_U9PwBhfZWuJDrn-Gek2u9FQsp2Nb0de-SK0c8mdAeodN/items/{original_files_dict[filename]['id']}?version=Published&access_token=v1.eyJzaXRlaWQiOiIzNTA4ZjFjZi01OGIzLTQyNzktODgyNC1lZWIzZTdlMWJmNTMiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvbGl2ZWxhbmNzYWMuc2hhcmVwb2ludC5jb21AOWM5YmNkMTEtOTc3YS00ZTljLWE5YTAtYmM3MzQwOTAxNjRhIiwiZXhwIjoiMTczNDgzNjQwMCJ9.CiMKCXNoYXJpbmdpZBIWY0NzbFZVUE1XVXlZakpHZ3lFRGp4dwoICgNzdHASAXQKCgoEc25pZBICMzMSBgjK6ToQARoOMTg3LjE4OS41MC4xMzAiFG1pY3Jvc29mdC5zaGFyZXBvaW50KixOcGVsbXdTeHlqekgwcTFCTWNTdWg5WTlaU0dFV1VaVmFVbGx4WkkrT2o0PTB2OAFKEGhhc2hlZHByb29mdG9rZW5iBHRydWVyNjBoLmZ8bWVtYmVyc2hpcHx1cm4lM2FzcG8lM2FndWVzdCNub3pkcmVua292QGdtYWlsLmNvbXoBMMIBNjAjLmZ8bWVtYmVyc2hpcHx1cm4lM2FzcG8lM2FndWVzdCNub3pkcmVua292QGdtYWlsLmNvbQ.guFa5T27BQPYZueDayP9f3zfm_1Rpt6iU7nOd-HbO1o",
                "isFolder": False
            }
            for filename in original_files_dict
        ]
    }
    
    data = {
        'zipFileName': 'OneDrive_1_21-12-2024.zip',
        'guid': '8a154f39-dcfd-4e11-8e46-ce7d7857c4b8',
        'provider': 'spo',
        'files': json.dumps(files_data),
        'oAuthToken': ''
    }
    
    # Make the request and save the file
    response = requests.post(url, headers=headers, data=data)
    
    if response.status_code == 200:
        with open(output_filename, 'wb') as f:
            f.write(response.content)
        print(f"Successfully downloaded files to {output_filename}")
    else:
        print(f"Error downloading files: {response.status_code}")
        print(response.text)

# Call the function with your desired output filename
download_files('my_downloaded_files.zip')