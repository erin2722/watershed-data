# Watershed Email Data

## Prerequisites
Download Node.js if you haven't already: https://nodejs.org/en/download/

Check node version: `node -v` (should be version 10 or greater)

Check npm version: `npm -v` (this relies on your node version)

Get the Constant Contact **app key** and **access token** for the watershed account using the [instructions](https://developer.constantcontact.com/docs/authentication/authentication.html) under the `Access Tokens and Single User Integrations` section.

## How to use
Clone the repository and run `npm i` to download the necessary dependencies for the project.

Create a `.env` folder in the root directory containing:
```
APP_KEY=<YOUR APP KEY HERE>
ACCESS_TOKEN=<YOUR ACCESS TOKEN HERE>
```

Create an `output.csv` file in the root directory.

Run `node main.js` to execute the script. The output will be in the `output.csv` file.

