FROM mhart/alpine-node

RUN apk add --update --no-cache \
  ffmpeg python make git \
  --repository http://dl-3.alpinelinux.org/alpine/edge/testing \
  vips-dev fftw-dev gcc g++ make libc6-compat

RUN wget https://github.com/ecal-mid/prepro-cli/archive/0.0.16.zip \
    && unzip 0.0.16.zip \
    && mv prepro-cli-0.0.16 prepro-cli

WORKDIR /prepro-cli
RUN npm install

WORKDIR /prepro
COPY ./src /prepro/src
COPY ./package.json /prepro/package.json
RUN npm install

ENTRYPOINT ["node", "src/index.js"]
