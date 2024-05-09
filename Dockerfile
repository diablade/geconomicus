#docker build -t geco:1.0 .
FROM node:18.20.2-alpine
MAINTAINER Nicolas Markovic
COPY ./config/.env ./back/.env
COPY ./config/constantes.js ./config/constantes.js
COPY ./back ./back
VOLUME /logs

WORKDIR /back
ENV PATH /app/node_modules/.bin:$PATH
RUN npm install && npm cache clean --force

RUN npm run cleanProd
CMD ["node","app.js"]
EXPOSE 8085
