FROM node:20-alpine

WORKDIR /app

# Instalar dependencias de forma reproducible y sin dev deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código fuente con permisos correctos
COPY --chown=node:node . .

# No correr como root
USER node

EXPOSE 8081

CMD ["node", "server.js"]
