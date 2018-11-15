FROM node:11-alpine

ADD hubot /hubot
WORKDIR /hubot
RUN npm install
ENTRYPOINT ["/hubot/start_prod.sh"]
