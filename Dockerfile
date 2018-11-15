FROM node:11-alpine

ADD hubot /hubot
WORKDIR /hubot
RUN npm install
ENTRYPOINT ["bin/hubot", "-a", "zulip"]
