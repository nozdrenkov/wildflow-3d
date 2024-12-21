import requests
import json

def extract_id_from_url(url):
  start_index = url.find("items/") + len("items/")

  end_index = url.find("?", start_index)
  if end_index == -1:
    end_index = url.find("/", start_index)

  if end_index == -1:
    return None  # No ID found

  return url[start_index:end_index]

def get_sharepoint_files():
    url = 'https://livelancsac.sharepoint.com/sites/Grp-MSSSpermonderestorationfieldwork/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream'
    
    params = {
        '@a1': "'/sites/Grp-MSSSpermonderestorationfieldwork/Shared Documents'",
        'TryNewExperienceSingle': 'TRUE',
        'Paged': 'TRUE',
        'p_FileLeafRef': 'GP_Right (1684).JPG',
        # 'p_FileLeafRef': 'GP_Right (1595).JPG',
        'p_ID': '705404',
        'RootFolder': '/sites/Grp-MSSSpermonderestorationfieldwork/Shared Documents/General/Photogrammetry 2024/50mx20m plots/Photos + Metashape projects/M7_Salisi_Kecil_Healthy_26.06.2024/M7_Salisi_Kecil_Healthy_26.06.2024_photos',
        'ix_Paged': 'TRUE',
        'ix_ID': '705404',
        'ix_Key': '01OBEEJLNN24VT5SJFKJC3VUQGGAML44WJ',
        'PageFirstRow': '5100',
        'View': '4c8e099f-44a3-4b9e-8bef-ada5717b68da'
    }
    
    headers = {
        'accept': 'application/json;odata=verbose',
        'accept-language': 'en-US',
        'application': 'sp_files',
        'authorization': 'Bearer',  # Add your actual bearer token here
        'content-type': 'application/json;odata=verbose',
        'cookie': 'MSFPC=GUID=7b2feaa9a1bb4b5283031ec4e8fc352e&HASH=7b2f&LV=202405&V=4&LU=1717070853539; FeatureOverrides_experiments=[]; WordWacDataCenter=GUK3; WordWacDataCenterSetTime=2024-12-21T00:34:26.174Z; ExcelWacDataCenter=PUS9; WacDataCenter=PUS9; ExcelWacDataCenterSetTime=2024-12-21T01:25:45.184Z; WacDataCenterSetTime=2024-12-21T01:25:45.184Z; WSS_FullScreenMode=false; MicrosoftApplicationsTelemetryDeviceId=52cf9f05-ce67-47b1-a976-556eeece3f31; FedAuth=77u/PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48U1A+VjEzLDBoLmZ8bWVtYmVyc2hpcHx1cm4lM2FzcG8lM2FndWVzdCNub3pkcmVua292QGdtYWlsLmNvbSwwIy5mfG1lbWJlcnNoaXB8dXJuJTNhc3BvJTNhZ3Vlc3Qjbm96ZHJlbmtvdkBnbWFpbC5jb20sMTMzNzkyMTM4MzMwMDAwMDAwLDAsMTMzNzkzNzg5NDYyMDc1NzI5LDAuMC4wLjAsMTAyNiw5YzliY2QxMS05NzdhLTRlOWMtYTlhMC1iYzczNDA5MDE2NGEsLCxiODhiNmZhMS01MGZiLWEwMDAtZjc3Ni0wZmNmMjM4ZjQxNzgsMTNkNzZmYTEtZjA0OC1hMDAwLWY3NzYtMDMxY2NlZDliMjViLGNDc2xWVVBNV1V5WWpKR2d5RURqeHcsMTMzNzkyMTM1Mzk4NzU3MjIzLDAsMCwsLCwyNjUwNDY3NzQzOTk5OTk5OTk5LDAsLCwsLCwsMCwsMTg5OTY2LHVYZWhRSlBsZVZqTkNiYWtVaEdENkl5RlFRayxJb2ZrMjhWWmlkb21EOHk2emlobWtGNzBCMUJMdWJNR201K2Q5M0pZU2FYWUlBSnpCcVh6MzZiYVQ1S1loWXJ4REIxYXRMdXYrOUd0eE9scnpCWmFkZjJjMTVjUkpDQzZ1VlcvMkxkK0pFRTB1T1RKVHpYOGwvZkhFd3Y2aU1kTWp1UnlmZ0RhZlZ0QURFOVdyRmVNeFNmcXpGdUpGd1dJdlVvcmhBaHQ4M1VpOUMxanRDZEJkWnpidm1BR053dnlhWnJYaXhZWGU5dnJjWDFqbjdhbnJVMmlWVFp4MWNYamJjTTdtNjMrcXYxWkw4NjdPSEovN1FVMW4rNnJKZUhKcTR1ZVNMM2NIZVdYc0grVXdkTG80b2JSaE5lVmNjdmJTSG5KVU9UaXliakJRYlo3QXNaby9XSUh0dk9QdERzUlJQZ25nVzJzNUVVajAwdXJuVVo0S0E9PTwvU1A+',
        'origin': 'https://livelancsac.sharepoint.com',
        'referer': 'https://livelancsac.sharepoint.com/sites/Grp-MSSSpermonderestorationfieldwork/Shared%20Documents/Forms/AllItems.aspx',
        'x-clientservice-clienttag': 'SPList Web',
        'x-requestdigest': '0xA218657CE54C3778BDEA70645F478AA48839E463583DC430D076629D08AA59863020BA9D611A727C6B7F4EC31621E642B909462FF78392F935EAB19621AC79AF,21 Dec 2024 22:10:13 -0000',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'x-ms-cc': 't'
    }
    
    data = {
        "parameters": {
            "__metadata": {"type": "SP.RenderListDataParameters"},
            "RenderOptions": 1478663,
            "ViewXml": "<View Name=\"{4C8E099F-44A3-4B9E-8BEF-ADA5717B68DA}\" DefaultView=\"TRUE\" MobileView=\"TRUE\" MobileDefaultView=\"TRUE\" Type=\"HTML\" DisplayName=\"All Documents\" Url=\"/sites/Grp-MSSSpermonderestorationfieldwork/Shared Documents/Forms/AllItems.aspx\" Level=\"1\" BaseViewID=\"1\" ContentTypeID=\"0x\" ImageUrl=\"/_layouts/15/images/dlicon.png?rev=47\"><Query><OrderBy><FieldRef Name=\"FileLeafRef\"/></OrderBy></Query><ViewFields><FieldRef Name=\"DocIcon\"/><FieldRef Name=\"LinkFilename\"/><FieldRef Name=\"Modified\"/><FieldRef Name=\"Editor\"/><FieldRef Name=\"FileSizeDisplay\"/></ViewFields><RowLimit Paged=\"TRUE\">9999</RowLimit><JSLink>clienttemplates.js</JSLink><XslLink Default=\"TRUE\">main.xsl</XslLink><Toolbar Type=\"Standard\"/></View>",
            "AllowMultipleValueFilterForTaxonomyFields": True,
            "AddRequiredFields": True,
            "RequireFolderColoringFields": True
        }
    }

    try:
        response = requests.post(url, params=params, headers=headers, json=data)
        response.raise_for_status()
        
        # Parse the response
        response_data = response.json()
        files_list = []
        
        if 'ListData' in response_data and 'Row' in response_data['ListData']:
            for item in response_data['ListData']['Row']:
                file_info = {
                    'filename': item['FileLeafRef'],
                    'file_size': item['File_x0020_Size'],  # size in bytes
                    'file_id': extract_id_from_url(item['.spItemUrl'])
                }
                files_list.append(file_info)
        
        return files_list
        
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        return None

# Example usage
if __name__ == "__main__":
    files = get_sharepoint_files()
    if files:
        with open('files_2024_3.json', 'w') as file:
            json.dump(files, file)
        print(f"{len(files)} files saved to files_2024.json")