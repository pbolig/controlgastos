# 1. Usar una imagen base de Python ligera y oficial
FROM python:3.11-slim

# 2. Establecer el directorio de trabajo DENTRO del contenedor
WORKDIR /app

# 3. Copiar solo el archivo de requisitos primero
# (Esto aprovecha el caché de Docker: si no cambian, no reinstala todo)
COPY requirements.txt .

# 4. Instalar las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiar TODO el resto de tu aplicación al contenedor
# (app.py, static/, templates/, instance/, etc.)
COPY . .

# 6. Exponer el puerto en el que correrá Gunicorn
EXPOSE 5000

# 7. Comando de inicio: Primero ejecuta la migración y LUEGO inicia Gunicorn.
# El '&&' asegura que Gunicorn solo se inicie si la migración es exitosa.
# Esto automatiza la actualización de la base de datos cada vez que se despliega una nueva versión del contenedor.
CMD ["sh", "-c", "python migracion_produccion.py && gunicorn --bind 0.0.0.0:5000 app:app"]