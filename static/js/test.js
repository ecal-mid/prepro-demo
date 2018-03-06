window.test = {};

window.test.docs = [
  {
    id: '1520207024550_video_test_micro.mov',
    data_: {
      log: {
        video2audio: 'complete',
        video2frames: 'complete',
      },
      output: 'tmp/1520207024550_video_test_micro.mov.zip',
      status: 'complete',
    }
  },
  {
    id: '1520207024550_video_test_micro.mov',
    data_: {
      log: {
        video2audio: 'complete',
        video2frames: 'complete',
      },
      output: 'tmp/1520207024550_video_test_micro.mov.zip',
      status: 'complete',
    }
  },
  {
    id: '1520207024550_video_test_micro.mov',
    data_: {
      log: {
        video2audio: 'complete',
        video2frames: 'processing',
      },
      output: 'tmp/1520207024550_video_test_micro.mov.zip',
      status: 'processing',
    }
  },
  {
    id: '1520207024550_video_test_micro.mov',
    data_: {
      status: 'waiting',
    },
  }
];
for (let d of window.test.docs) {
  d.data = () => d.data_;
}
