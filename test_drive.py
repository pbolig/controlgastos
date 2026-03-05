from app import get_drive_service

try:
    print("Intentando inicializar Google Drive...")
    service = get_drive_service()
    print("¡Inicializado con éxito!")
    
    # Intenta buscar una carpeta
    import os
    folder = os.environ.get('DRIVE_FOLDER_ID') or "1Cjo4bRT1Bo4o-EU2epi7Ggo5GBg-Stja"
    print(f"Folder ID local: {folder}")
    
    file_metadata = {
        'name': 'test_upload.txt',
        'parents': [folder]
    }
    
    import io
    from googleapiclient.http import MediaIoBaseUpload
    media = MediaIoBaseUpload(io.BytesIO(b"Hello world"), mimetype='text/plain', resumable=True)
    
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"Subida exitosa, ID: {file.get('id')}")

except Exception as e:
    import traceback
    traceback.print_exc()
