import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import io
import time

load_dotenv()

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# ID de la carpeta de producción en Google Drive (docgastosprod)
DRIVE_FOLDER_PROD = "19REvkvXWGXCD8oZO8S4DPsAWFhEbj13c"
SERVICE_ACCOUNT_FILE = 'google_credentials.json'

def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=['https://www.googleapis.com/auth/drive'])
    return build('drive', 'v3', credentials=creds)

def get_db_connection():
    # Nos conectamos a SUPABASE (Producción) para la migración
    # Asegúrate de que en tu .env temporalmente .SUPABASE_URL apunte a Producción o define PRODUCTION_DB_URL
    db_url = os.environ.get("SUPABASE_URL")
    return psycopg2.connect(db_url)

def migrar_comprobantes():
    print("Conectando a Google Drive...")
    drive_service = get_drive_service()
    
    print("Conectando a la base de datos...")
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Buscar comprobantes que NO sean IDs de Drive (es decir, que tengan '/')
    cursor.execute("SELECT id, descripcion, comprobante_path FROM transacciones WHERE comprobante_path IS NOT NULL AND comprobante_path LIKE '%/%'")
    transacciones = cursor.fetchall()
    
    print(f"Se encontraron {len(transacciones)} transacciones con comprobantes antiguos (locales).")
    
    upload_count = 0
    error_count = 0
    
    for t in transacciones:
        old_path = t['comprobante_path']
        trans_id = t['id']
        local_file_path = os.path.join('uploads', old_path.replace('/', os.sep))
        
        if not os.path.exists(local_file_path):
            print(f"[{trans_id}] ADVERTENCIA: Archivo local no encontrado: {local_file_path}")
            error_count += 1
            continue
            
        print(f"[{trans_id}] Subiendo: {old_path} ...", end=" ")
        
        try:
            # Subir a Drive
            filename = os.path.basename(local_file_path)
            # Adivinar mimetype básico
            mimetype = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"
            if filename.lower().endswith(".png"): mimetype = "image/png"
            
            file_metadata = {
                'name': filename,
                'parents': [DRIVE_FOLDER_PROD]
            }
            
            with open(local_file_path, "rb") as f:
                media = MediaIoBaseUpload(io.BytesIO(f.read()), mimetype=mimetype, resumable=True)
                
            drive_file = drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            new_drive_id = drive_file.get('id')
            
            # Actualizar Base de Datos
            update_cursor = conn.cursor()
            update_cursor.execute("UPDATE transacciones SET comprobante_path = %s WHERE id = %s", (new_drive_id, trans_id))
            conn.commit()
            
            print(f"OK (ID Drive: {new_drive_id})")
            upload_count += 1
            
            # Pequeña pausa para no saturar la API de Drive
            time.sleep(0.5)
            
        except Exception as e:
            print(f"ERROR: {e}")
            error_count += 1
            
    print(f"\nMigración completada. {upload_count} subidos. {error_count} errores.")

if __name__ == '__main__':
    migrar_comprobantes()
