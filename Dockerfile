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

# 7. El comando para INICIAR la aplicación en producción
# Llama a Gunicorn, le dice que escuche en todas las IPs (0.0.0.0:5000)
# y que sirva la variable 'app' que está en el archivo 'app.py'
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]