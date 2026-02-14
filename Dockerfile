FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npm i typescript -D
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
