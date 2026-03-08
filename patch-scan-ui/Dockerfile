FROM node:20-alpine
ENV TZ=America/Vancouver
WORKDIR /app
COPY package*.json .
RUN apk add --no-cache tzdata && npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]