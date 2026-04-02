# How To Use It

step 0. Copy the below yaml file.

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

step 1. Open your own GitHub repository and click the Actions tab
This is where you can create and run GitHub Actions workflows.

![Step 1](screenshots/screenshot1.png)


![Step 2](screenshots/screenshot2.png)


![Step 3](screenshots/screenshot3.png)


![Step 4](screenshots/screenshot4.png)


![Step 5](screenshots/screenshot5.png)


![Step 6](screenshots/screenshot6.png)


![Step 7](screenshots/screenshot7.png)


![Step 8](screenshots/screenshot8.png)
   
