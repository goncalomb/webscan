# webscan

## Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

* `npm start`: run the app in development mode
* `npm test`: launches the test runner (not used)
* `npm run build`: build the app for production
* `npm run eject`: eject from `react-scripts` (not to be used)

## Extra Scripts

* `npm run serve`: run the app with the `serve` server

## Building

### Development Build

    ./build-sane-wasm.sh
    npm install
    npm start

### Local Build

    ./build-sane-wasm.sh
    npm install
    npm run build && npm run serve

### Docker Build

    ./build-sane-wasm.sh
    docker build -t webscan . && docker run --rm -p 80:3000 webscan
