#docker build -t geco:1.0 .
FROM node:22.14.0-alpine
MAINTAINER Nicolas Markovic
COPY ./config/.env ./back/.env
COPY config/constantes.mjs ./config/constantes.mjs
COPY ./back ./back
VOLUME /logs

WORKDIR /back
ENV PATH /app/node_modules/.bin:$PATH
RUN npm install && npm cache clean --force

RUN npm run cleanProd
CMD ["node","./src/app.js"]
EXPOSE 8085
