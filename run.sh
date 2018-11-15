#!/bin/sh

set -e

. $HOME/.lc_check_botrc
docker run \
  -e CN_LC_APP_ID \
  -e CN_LC_APP_KEY \
  -e CN_LC_LE_WEB_URL \
  -e US_LC_APP_ID \
  -e US_LC_APP_KEY \
  -e US_LC_LE_WEB_URL \
  -e HUBOT_ZULIP_BOT \
  -e HUBOT_ZULIP_API_KEY \
  -e HUBOT_ZULIP_SITE \
  -e HUBOT_ZULIP_ONLY_SUBSCRIBED_STREAMS \
  -d --name r2 check-bot
