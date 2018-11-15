source .lc_keys
docker run \
  -e CN_LC_APP_ID=$CN_LC_APP_ID \
  -e CN_LC_APP_KEY=$CN_LC_APP_KEY \
  -e CN_LC_LE_WEB_URL=$CN_LC_LE_WEB_URL \
  -e US_LC_APP_ID=$US_LC_APP_ID \
  -e US_LC_APP_KEY=$US_LC_APP_KEY \
  -e US_LC_LE_WEB_URL=$US_LC_LE_WEB_URL \
  -d --name r2 check-bot
