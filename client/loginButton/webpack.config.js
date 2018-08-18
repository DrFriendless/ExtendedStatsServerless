const path = require('path');

module.exports = {
    entry: './src/loginButton.ts',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ]
    },
    output: {
        filename: 'loginButton.js',
        path: path.resolve(__dirname, '../static'),
        library: 'loginButton'
    }
};
