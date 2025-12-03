# Control de Gastos

`Control de Gastos` es una aplicación web desarrollada en Flask (Python) y JavaScript para la gestión de finanzas personales. Permite un seguimiento detallado de ingresos, gastos, movimientos recurrentes y planes de cuotas, con soporte multimoneda y la capacidad de adjuntar comprobantes.

---

## 📜 Índice

1.  Funcionalidades Principales
2.  Instalación desde Cero (VPS Linux)
3.  Actualización del Desarrollo
4.  Tareas de Mantenimiento
    - Eliminar Comprobantes Antiguos
    - Crear Backups con Tareas Cron

---

## ✨ Funcionalidades Principales

*   **Registro de Movimientos**: Ingresa gastos e ingresos de forma rápida.
*   **Gestión de Categorías**: Crea y asigna categorías personalizadas a tus movimientos.
*   **Soporte Multimoneda**: Registra transacciones en ARS y USD, con resúmenes separados.
*   **Gastos Recurrentes**: Define pagos o cobros mensuales (sueldos, alquiler, servicios) y márcalos como pagados cada mes.
*   **Planes de Cuotas**: Lleva un control de compras en cuotas, con seguimiento del progreso y pago mensual.
*   **Gestión de Tarjetas de Crédito**: Define tus tarjetas como un gasto recurrente especial y asocia planes de cuotas a ellas.
*   **Adjuntar Comprobantes**: Sube un archivo (PDF, imagen, etc.) a cada transacción para un registro más completo.
*   **Dashboard Interactivo**: Visualiza resúmenes mensuales de ingresos, gastos, saldo y montos pendientes.
*   **Historial y Reportes**: Consulta el historial completo de transacciones y filtra por fecha, tipo, categoría y moneda.
*   **Seguridad**: Acceso protegido por contraseña.

---

## 🚀 Instalación desde Cero (VPS Linux)

Sigue estos pasos para desplegar la aplicación en un servidor virtual (VPS) con Ubuntu/Debian.

### Paso 1: Conectar al VPS y Actualizar el Sistema

Primero, conéctate a tu servidor por SSH. Luego, actualiza los paquetes e instala las herramientas necesarias.

```bash
# Actualiza la lista de paquetes e instala las actualizaciones pendientes
sudo apt update && sudo apt upgrade -y

# Instala Python, el gestor de paquetes pip, el gestor de entornos virtuales, Git y el servidor web Nginx
sudo apt install python3 python3-pip python3-venv git nginx -y
```

### Paso 2: Clonar el Repositorio

Clona el código fuente de la aplicación desde tu repositorio de GitHub.

```bash
# Reemplaza <URL_DE_TU_REPOSITORIO> con la URL real
git clone <URL_DE_TU_REPOSITORIO> control_gastos

# Ingresa a la carpeta del proyecto
cd control_gastos
```

### Paso 3: Configurar el Entorno Virtual e Instalar Dependencias

Crear un entorno virtual aísla las dependencias de tu proyecto.

```bash
# Crea el entorno virtual llamado 'venv'
python3 -m venv venv

# Activa el entorno virtual
source venv/bin/activate

# Instala todas las librerías de Python necesarias para el proyecto
pip install -r requirements.txt
```

### Paso 4: Configurar la Base de Datos

Ejecuta el script que crea la base de datos SQLite con toda su estructura y datos iniciales.

```bash
# Este comando creará el archivo gastos.db dentro de una carpeta 'instance'
python db_setup.py
```

### Paso 5: Configurar y Ejecutar Gunicorn

Gunicorn será el servidor de aplicaciones que ejecutará tu código Flask de manera eficiente.

```bash
# Dentro del entorno virtual (venv), puedes probar Gunicorn manualmente
# El --bind 0.0.0.0:5000 hace que sea accesible desde fuera del VPS (temporalmente)
gunicorn --workers 3 --bind 0.0.0.0:5000 app:app
```

Presiona `Ctrl+C` para detenerlo. Ahora, crearemos un servicio `systemd` para que se ejecute automáticamente en segundo plano.

```bash
# Crea y abre un nuevo archivo de servicio con el editor nano
sudo nano /etc/systemd/system/control_gastos.service
```

Pega el siguiente contenido en el archivo. **Asegúrate de reemplazar `/home/tu_usuario/control_gastos`** con la ruta real a tu proyecto.

```ini
[Unit]
Description=Gunicorn instance to serve control_gastos
After=network.target

[Service]
User=tu_usuario
Group=www-data
WorkingDirectory=/home/tu_usuario/control_gastos
Environment="PATH=/home/tu_usuario/control_gastos/venv/bin"
ExecStart=/home/tu_usuario/control_gastos/venv/bin/gunicorn --workers 3 --bind unix:control_gastos.sock -m 007 app:app

[Install]
WantedBy=multi-user.target
```

Guarda el archivo (`Ctrl+X`, luego `Y`, luego `Enter`). Ahora, inicia y habilita el servicio.

```bash
# Inicia el servicio
sudo systemctl start control_gastos

# Habilita el servicio para que se inicie automáticamente al encender el VPS
sudo systemctl enable control_gastos

# Verifica que esté corriendo sin errores
sudo systemctl status control_gastos
```

### Paso 6: Configurar Nginx como Reverse Proxy

Nginx recibirá las peticiones de los usuarios y las redirigirá internamente a Gunicorn.

```bash
# Crea un nuevo archivo de configuración para tu sitio
sudo nano /etc/nginx/sites-available/control_gastos
```

Pega la siguiente configuración, **reemplazando `tu_dominio_o_ip`** con el dominio o la IP de tu VPS.

```nginx
server {
    listen 80;
    server_name tu_dominio_o_ip;

    location / {
        include proxy_params;
        proxy_pass http://unix:/home/tu_usuario/control_gastos/control_gastos.sock;
    }
}
```

Guarda el archivo. Ahora, activa la configuración y reinicia Nginx.

```bash
# Crea un enlace simbólico para activar la configuración
sudo ln -s /etc/nginx/sites-available/control_gastos /etc/nginx/sites-enabled

# Verifica que la sintaxis de Nginx sea correcta
sudo nginx -t

# Reinicia Nginx para aplicar los cambios
sudo systemctl restart nginx
```

¡Listo! Ahora deberías poder acceder a tu aplicación desde el navegador usando la IP o el dominio de tu VPS.

---

## 🔄 Actualización del Desarrollo

Sigue estos pasos para actualizar la aplicación en el VPS después de haber subido cambios a GitHub.

### Paso 1: Subir Cambios a GitHub (en tu PC local)

```bash
# Añade todos los archivos modificados
git add .

# Crea un commit con un mensaje descriptivo
git commit -m "Agregada nueva funcionalidad de reportes"

# Sube los cambios a la rama principal (main)
git push origin main
```

### Paso 2: Actualizar el Código en el VPS

Conéctate a tu VPS por SSH y navega a la carpeta del proyecto.

```bash
# Navega a la carpeta del proyecto
cd /home/tu_usuario/control_gastos

# Descarga los últimos cambios desde GitHub
git pull origin main

# Activa el entorno virtual
source venv/bin/activate

# (Opcional) Si actualizaste el archivo requirements.txt, reinstala las dependencias
pip install -r requirements.txt

# (Opcional) Si hubo cambios en la base de datos, ejecuta el script de migración
python migracion_produccion.py
```

### Paso 3: Reiniciar el Servicio

Para que los cambios en el código se apliquen, reinicia el servicio de Gunicorn.

```bash
sudo systemctl restart control_gastos
```

La aplicación se actualizará sin tiempo de inactividad visible para el usuario.

---

## 🛠️ Tareas de Mantenimiento

### Eliminar Comprobantes Antiguos

Los comprobantes se guardan en la carpeta `uploads/` organizados por año. Para liberar espacio, puedes eliminar las carpetas de años que ya no necesites.

**Ejemplo**: Para eliminar todos los comprobantes del año 2023:

```bash
# Conéctate a tu VPS y navega a la carpeta del proyecto
cd /home/tu_usuario/control_gastos

# Elimina la carpeta del año 2023 de forma recursiva y forzada
# ¡ADVERTENCIA! Esta acción es irreversible.
rm -rf uploads/2023
```

### Crear Backups con Tareas Cron

Puedes automatizar la creación de backups de todo el sitio (código + base de datos + comprobantes) usando `cron`.

1.  **Crea una carpeta para los backups** fuera del directorio del proyecto.
    ```bash
    mkdir /home/tu_usuario/backups
    ```

2.  **Abre el editor de cron**.
    ```bash
    crontab -e
    ```

3.  **Añade la siguiente línea** al final del archivo. Esta tarea se ejecutará todos los días a las 3:00 AM.

    ```cron
    0 3 * * * /home/tu_usuario/control_gastos/backup_script.sh
    ```

4.  **Crea el script de backup** `backup_script.sh`.
    ```bash
    # Navega a la carpeta del proyecto
    cd /home/tu_usuario/control_gastos
    
    # Crea el script
    nano backup_script.sh
    ```

5.  **Pega el siguiente contenido** en `backup_script.sh`.

    ```bash
    #!/bin/bash
    
    # --- Configuración ---
    PROJECT_DIR="/home/tu_usuario/control_gastos"
    BACKUP_DIR="/home/tu_usuario/backups"
    DATE=$(date +"%Y-%m-%d_%H-%M-%S")
    BACKUP_FILE="$BACKUP_DIR/control_gastos_backup_$DATE.tar.gz"
    
    # --- Creación del Backup ---
    echo "Iniciando backup de $PROJECT_DIR..."
    tar -czf $BACKUP_FILE -C $(dirname $PROJECT_DIR) $(basename $PROJECT_DIR)
    echo "Backup creado en: $BACKUP_FILE"
    
    # --- Rotación de Backups (Mantener solo los últimos 2) ---
    echo "Rotando backups..."
    ls -tp $BACKUP_DIR/control_gastos_backup_*.tar.gz | grep -v '/$' | tail -n +3 | xargs -I {} rm -- {}
    echo "Rotación completada. Se conservan los 2 backups más recientes."
    ```

6.  **Dale permisos de ejecución** al script.
    ```bash
    chmod +x backup_script.sh
    ```

A partir de ahora, cada noche se creará un archivo `.tar.gz` con todo tu proyecto en la carpeta `/home/tu_usuario/backups`, y el sistema se asegurará de mantener solo las dos copias más recientes.