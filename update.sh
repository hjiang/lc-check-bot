#!/bin/sh

# This script can be run remotely through ssh.

set -e

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd $dir
git pull
./build.sh
docker stop r2
docker rm r2
./run.sh
