const path = require('path');

module.exports = {
    entry: './src/infrastructure.ts',
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
        filename: 'infrastructure-bundle.js',
        path: path.resolve(__dirname, '../static')
    }
};
