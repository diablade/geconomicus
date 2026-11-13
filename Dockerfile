#docker build -t geco:1.0 .
FROM node:22-alpine
MAINTAINER Nicolas Markovic
COPY ./back ./back
COPY ./shared ./shared
VOLUME /logs

WORKDIR /back
ENV PATH /app/node_modules/.bin:$PATH

ARG GECO_PORT_NODE=8085
ENV GECO_PORT_NODE=${GECO_PORT_NODE}

RUN npm install --omit=dev && npm cache clean --force

EXPOSE ${GECO_PORT_NODE}
CMD ["node","./src/server.js"]
