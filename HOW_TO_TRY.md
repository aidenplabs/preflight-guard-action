# How To Use It

0. Copy the below yaml file.

```yaml
name: Preflight Guard

on:
  pull_request:
  workflow_dispatch:

jobs:
  preflight:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Run preflight guard
        id: preflight
        uses: aidenplabs/preflight-guard-action@v1
        with:
          path: .
          output-dir: .preflight-ci
          fail-on: no

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: preflight-report
          path: .preflight-ci/
```


![Step 1](screenshots/screenshot1.png)


![Step 2](screenshots/screenshot1.png)


![Step 3](screenshots/screenshot1.png)


![Step 4](screenshots/screenshot1.png)


![Step 5](screenshots/screenshot1.png)


![Step 6](screenshots/screenshot1.png)


![Step 7](screenshots/screenshot1.png)


![Step 8](screenshots/screenshot1.png)
   
