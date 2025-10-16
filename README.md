# WebScan (webscan)

## Building

### Development Build

    npm install
    npm start

### Local Build

    npm install
    npm run build && npm run serve

### Docker Build

    docker build -t webscan . && docker run --rm -p 80:3000 webscan

## License

WebScan is released under the terms of the MIT License. See [LICENSE.txt](LICENSE.txt) for details.
