FROM mhart/alpine-node

RUN apk add --update --no-cache \
  ffmpeg python make git \
  --repository http://dl-3.alpinelinux.org/alpine/edge/testing \
  vips-dev fftw-dev gcc g++ make libc6-compat

RUN git clone https://github.com/ecal-mid/prepro-cli.git

WORKDIR /prepro-cli

RUN npm install

WORKDIR /prepro

COPY . /prepro

RUN npm install

ENTRYPOINT ["node", "src/index.js"]
