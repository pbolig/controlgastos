from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'google_credentials.json'

def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('drive', 'v3', credentials=creds)

def find_folders():
    service = get_drive_service()
    
    # We search for folders named docgastostest or docgastosprod
    # that are shared with the service account
    results = service.files().list(
        q="(name='docgastostest' or name='docgastosprod' or name='documentacionbk') and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)"
    ).execute()
    
    items = results.get('files', [])
    if not items:
        print('No folders found.')
    else:
        print('Folders:')
        for item in items:
            print(f"{item['name']} ({item['id']})")

if __name__ == '__main__':
    find_folders()
