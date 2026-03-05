import os
import io
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

# --- Configuración Supabase REST ---
SUPABASE_PROJECT_URL = os.environ.get("SUPABASE_PROJECT_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "comprobantes")

def get_db_connection():
    # Conectamos a tu BD (por defecto apuntará a la que tengas en .env como Supabase/Aiven)
    # ¡Asegúrate de que estás migrando la BD correcta! (Por lo general, PRODUCCIÓN)
    db_url = os.environ.get("SUPABASE_URL")
    return psycopg2.connect(db_url)

def migrar_comprobantes_a_supabase():
    if not SUPABASE_PROJECT_URL or not SUPABASE_KEY:
        print("ERROR: Faltan credenciales de Supabase en el archivo .env")
        return

    print(f"Conectando a la base de datos... [{os.environ.get('SUPABASE_URL')[:30]}...]")
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Buscar comprobantes que NO sean URLs o vacíos (los viejos solían tener el formato uploads/año/archivo)
    cursor.execute("SELECT id, descripcion, comprobante_path FROM transacciones WHERE comprobante_path IS NOT NULL AND comprobante_path LIKE '%/%'")
    transacciones = cursor.fetchall()
    
    print(f"Se encontraron {len(transacciones)} transacciones con comprobantes antiguos (locales).")
    
    upload_count = 0
    error_count = 0
    
    for t in transacciones:
        old_path = t['comprobante_path']
        trans_id = t['id']
        local_file_path = old_path.replace('/', os.sep)
        
        # En caso de que local_file_path no empiece con "uploads", forzamos el chequeo.
        if not local_file_path.startswith('uploads'):
            local_file_path = os.path.join('uploads', local_file_path)

        if not os.path.exists(local_file_path):
            print(f"[{trans_id}] ADVERTENCIA: Archivo físico no encontrado en tu PC: {local_file_path}")
            error_count += 1
            continue
            
        print(f"[{trans_id}] Subiendo: {old_path} a Supabase Storage...", end=" ")
        
        try:
            filename = os.path.basename(local_file_path)
            
            # Subir a Supabase Storage
            with open(local_file_path, "rb") as f:
                file_content = f.read()

            import mimetypes
            mimetype, _ = mimetypes.guess_type(local_file_path)
            if not mimetype:
                mimetype = "application/octet-stream"
            
            url = f"{SUPABASE_PROJECT_URL}/storage/v1/object/{STORAGE_BUCKET}/{old_path}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "apikey": SUPABASE_KEY,
                "Content-Type": mimetype
            }

            res = requests.post(url, headers=headers, data=file_content)
            
            if res.status_code == 200 or res.status_code == 201:
                print("OK")
                upload_count += 1
                # En este script NO cambiamos comprobante_path en BBDD porque old_path (ej. 'uploads/año/archivo.pdf') 
                # es la misma ruta con la que Supabase Storage guardará y servirá nuestro archivo.
            else:
                # Si dio error porque ya existe (409 Conflict), lo cuenta como OK.
                try:
                    error_json = res.json()
                    if error_json.get("statusCode") == "409" or error_json.get("error") == "Duplicate":
                        print("OK (Ya existía en Supabase)")
                        upload_count += 1
                        continue
                except:
                    pass
                print(f"ERROR HTTP {res.status_code}: {res.text}")
                error_count += 1
            
            time.sleep(0.3) # Evitar saturar el servidor
            
        except Exception as e:
            print(f"ERROR interno: {e}")
            error_count += 1
            
    print(f"\nMigración completada. {upload_count} archivos subidos exitosamente. {error_count} errores de archivo no encontrado o fallas.")

if __name__ == '__main__':
    migrar_comprobantes_a_supabase()
