cors.json

```json
[
  {
    "origin": [
      "https://wildflow.ai",
      "https://3d.wildflow.ai",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://wildflow-demo.firebaseapp.com",
      "https://wildflow-demo.web.app",
      "https://nozdrenkov.ghost.io",
      "https://nozdrenkov.com"
    ],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Cross-Origin-Resource-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Embedder-Policy"
    ],
    "maxAgeSeconds": 3600
  }
]
```

```
$ gsutil cors set cors.json gs://wildflow
$ gsutil cors get gs://wildflow
```
